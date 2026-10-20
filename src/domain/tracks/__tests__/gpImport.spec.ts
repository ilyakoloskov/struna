import { describe, expect, it } from 'vitest'
import * as at from '@coderline/alphatab'
import { Midi } from '@tonejs/midi'
import {
  GpImportError,
  createTickClock,
  gmFamily,
  gmName,
  loadGpScore,
  scoreToSong,
} from '../gpImport'

function fromTex(tex: string) {
  const importer = new at.importer.AlphaTexImporter()
  importer.initFromString(tex, new at.Settings())
  return importer.readScore()
}

const LEAD = `\\title "Riff" \\artist "Test" \\tempo 120
\\track "Lead" \\instrument 29
\\staff {tabs} \\tuning (E4 B3 G3 D3 A2 E2)
\\ro \\rc 2 0.6.4 3.6.4 5.5.4 5.4.4 | (0.6 2.5 2.4).2 x.6.4 7.3.4 |`

describe('scoreToSong', () => {
  const song = scoreToSong(at, fromTex(LEAD))
  const lead = song.tracks[0]!

  it('название, темп, размер, инструмент', () => {
    expect(song.name).toBe('Test — Riff')
    expect(song.bpm).toBe(120)
    expect(song.timeSignature).toEqual([4, 4])
    expect(lead.instrument).toMatchObject({
      program: 29,
      name: 'overdriven guitar',
      family: 'guitar',
    })
  })

  it('строй из файла — от низкой струны к высокой', () => {
    expect(lead.tuning).toEqual([40, 45, 50, 55, 59, 64])
  })

  it('повторы раскрыты: первый такт звучит дважды', () => {
    const firstBar = lead.notes.filter((n) => n.time < 4)
    expect(firstBar.map((n) => n.midi)).toEqual([40, 43, 50, 55, 40, 43, 50, 55])
    expect(firstBar.map((n) => n.time)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5])
  })

  it('позиции из файла: струна (от низкой) и лад', () => {
    expect(lead.positions!.slice(0, 4)).toEqual([
      { stringIndex: 0, fret: 0 },
      { stringIndex: 0, fret: 3 },
      { stringIndex: 1, fret: 5 },
      { stringIndex: 2, fret: 5 },
    ])
    expect(lead.positions).toHaveLength(lead.notes.length)
  })

  it('аккорд — ноты в одно время; глухая нота — с приёмом dead', () => {
    const chord = lead.notes.filter((n) => n.time === 4)
    expect(chord.map((n) => n.midi)).toEqual([40, 47, 52])
    expect(chord[0]!.duration).toBeCloseTo(1)
    const dead = lead.notes.findIndex((n) => n.time === 5) // x.6
    expect(lead.techniques?.[dead]).toEqual({ dead: true })
    expect(lead.notes.at(-1)).toMatchObject({ midi: 62, time: 5.5 })
  })

  it('сетка долей и длительность с учётом повторов', () => {
    expect(song.beats).toHaveLength(12)
    expect(song.beats.filter((b) => b.downbeat).map((b) => b.time)).toEqual([0, 2, 4])
    expect(song.duration).toBeCloseTo(6)
  })

  it('смена темпа и залиги', () => {
    const s = scoreToSong(
      at,
      fromTex(`\\tempo 120
\\track "G" \\staff {tabs}
0.6.4 0.6.4 0.6.2 | \\tempo 60 0.6.2 -.6.2 |`),
    )
    const notes = s.tracks[0]!.notes
    // 3 ноты на 120 (0, 0.5, 1), затем такт на 60 bpm: половинная = 2 с, залигована со следующей
    expect(notes.map((n) => n.time)).toEqual([0, 0.5, 1, 2])
    expect(notes.at(-1)!.duration).toBeCloseTo(4)
  })
})

describe('GP-файл целиком', () => {
  it('экспорт GP7 → загрузка → те же ноты', () => {
    const bytes = new at.exporter.Gp7Exporter().export(fromTex(LEAD), new at.Settings())
    const song = scoreToSong(at, loadGpScore(at, bytes), 'riff.gp')
    expect(song.tracks[0]!.notes.map((n) => n.midi)).toEqual(
      scoreToSong(at, fromTex(LEAD)).tracks[0]!.notes.map((n) => n.midi),
    )
  })

  it('мусор — понятная ошибка', () => {
    expect(() => loadGpScore(at, new Uint8Array([1, 2, 3, 4]))).toThrow(GpImportError)
  })
})

describe('createTickClock', () => {
  it('тики → секунды по карте темпов', () => {
    const toSeconds = createTickClock([
      { tick: 0, bpm: 120 },
      { tick: 1920, bpm: 60 },
    ])
    expect(toSeconds(960)).toBeCloseTo(0.5)
    expect(toSeconds(1920)).toBeCloseTo(1)
    expect(toSeconds(2880)).toBeCloseTo(2)
  })
})

describe('названия GM', () => {
  it('совпадают с @tonejs/midi — по ним выбираются сэмплы', () => {
    const track = new Midi().addTrack()
    for (let program = 0; program < 128; program++) {
      track.instrument.number = program
      expect(gmName(program)).toBe(track.instrument.name)
      expect(gmFamily(program)).toBe(track.instrument.family)
    }
  })
})

describe('приёмы из Guitar Pro', () => {
  const song = scoreToSong(
    at,
    fromTex(`\\track "G" \\staff {tabs} \\tuning (E4 B3 G3 D3 A2 E2)
12.6{nh}.4 7.3{b (0 4)}.4 5.3{h}.8 7.3.8 7.3{h}.8 5.3.8 |
5.3{sl}.4 7.3.4 5.3{ss}.4 7.3.4 |
x.6.4 3.6{pm}.4 5.2{v}.4 5.2{sib}.4 |
5.2{sou}.4 7.2{b prebendrelease (4 4 0)}.4 5.2{ph 5}.4 r.4 |`),
  )
  const track = song.tracks[0]!
  const noteAt = (time: number) => {
    const i = track.notes.findIndex((n) => n.time === time)
    return {
      note: track.notes[i]!,
      position: track.positions![i]!,
      technique: track.techniques?.[i],
    }
  }

  it('натуральный флажолет: лад из файла, высота — флажолета', () => {
    const { note, position, technique } = noteAt(0)
    expect(position).toEqual({ stringIndex: 0, fret: 12 })
    expect(note.midi).toBe(52)
    expect(technique).toEqual({ harmonic: 'natural' })
  })

  it('искусственный флажолет звучит выше прижатого лада', () => {
    const { note, position, technique } = noteAt(7)
    expect(position.fret).toBe(5)
    expect(note.midi).toBeGreaterThan(64)
    expect(technique).toEqual({ harmonic: 'artificial' })
  })

  it('бенд и пребенд с отпусканием — в полутонах', () => {
    expect(noteAt(0.5).technique).toEqual({ bend: { from: 0, peak: 2, to: 2 } })
    expect(noteAt(0.5).note.midi).toBe(62) // высота — прижатый лад
    expect(noteAt(6.5).technique).toEqual({ bend: { from: 2, peak: 2, to: 0 } })
  })

  it('хаммер-он и пулл-офф отмечены на второй ноте', () => {
    expect(noteAt(1).technique).toBeUndefined()
    expect(noteAt(1.25).technique).toEqual({ legato: 'hammer' })
    expect(noteAt(1.75).technique).toEqual({ legato: 'pull' })
  })

  it('слайды: легато ведёт в ноту без удара, шифт — с ударом, «в никуда», въезд', () => {
    expect(noteAt(2).technique).toEqual({ slideOut: { frets: 2, toNote: true } })
    expect(noteAt(2.5).technique).toEqual({ legato: 'slide' })
    expect(noteAt(3).technique).toEqual({ slideOut: { frets: 2, toNote: true } })
    expect(noteAt(3.5).technique).toBeUndefined()
    expect(noteAt(5.5).technique).toEqual({ slideIn: 'below' })
    expect(noteAt(6).technique).toEqual({ slideOut: { frets: 3, toNote: false } })
  })

  it('глухая нота, палм-мьют, вибрато', () => {
    expect(noteAt(4).technique).toEqual({ dead: true })
    expect(noteAt(4.5).technique).toEqual({ palmMute: true })
    expect(noteAt(5).technique).toEqual({ vibrato: true })
  })

  it('массив приёмов совпадает с нотами; без приёмов — не хранится', () => {
    expect(track.techniques).toHaveLength(track.notes.length)
    const plain = scoreToSong(at, fromTex(`\\track "G" \\staff {tabs} 0.6.4 3.6.4 |`))
    expect(plain.tracks[0]!.techniques).toBeUndefined()
  })
})
