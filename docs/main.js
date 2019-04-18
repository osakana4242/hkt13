window.AudioaudioContext = window.AudioaudioContext || window.webkitAudioaudioContext;

const AppState = {
	INIT: 0,
	SELECT: 1,
	RESULT: 2,
	GAMEOVER: 3,
};

class App {
	constructor() {
		this.audioContext = new AudioContext();
		this.bufferSources = [];
		this.questLevel = 1;
		this.state = AppState.INIT;
		this.contentElem = document.getElementById('content');
	}

	static async getAudioBuffer(audioContext, url) {
		const response = await fetch(url);
		const buffer = await response.arrayBuffer();

		const r2 = await new Promise((resolve, reject) => {
			audioContext.decodeAudioData(buffer, resolve);
		});

		return r2;
	}

	// サウンドを再生
	static playSound(audioContext, buffer) {
		// source を作成
		var source = audioContext.createBufferSource();
		// buffer をセット
		source.buffer = buffer;
		// audioContext に connect
		source.connect(audioContext.destination);
		// 再生
		source.start(0);
		return source;
	}

	static stopSoundAll(app) {
		for (var i = 0; i < app.bufferSources.length; i++) {
			app.bufferSources[i].stop();
		}
		app.bufferSources.splice(0, app.bufferSources.length);
	}

	static update(app) {
		switch (app.state) {
			case AppState.INIT: {
				app.questLevel = 1;
				app.state = AppState.SELECT;
				App.update(app);
				break;
			}
			case AppState.SELECT: {
				const quest = QuestGenerator.generate(app.questLevel);

				var html =
					`<div>${app.questLevel}問目</div>` +
					'<div>' +
					'<button id="btn-play-a">試聴</button>' +
					`<div>${quest.subject.description}</div>` +
					'</div>' +
					'';

				quest.answerArr.forEach((item, index) => {

					html +=
						`<div>` +
						`${index}: ` +
						`<button id="btn-play-item${index}">試聴</button>` +
						`<button id="btn-ok-item${index}">決定</button>` +
						`</div>`;
				});

				app.contentElem.innerHTML = html;

				quest.answerArr.forEach((item, index) => {
					const btnPlayElem = document.getElementById(`btn-play-item${index}`);
					const btnOkElem = document.getElementById(`btn-ok-item${index}`);
					const note = NOTE_DATA[item.noteId];
					btnPlayElem.addEventListener('click', () => {
						App.stopSoundAll(app);
						var bufferSource = App.playSound(app.audioContext, App.getAudioBufferGenerator(item.shape)(app.audioContext, note.freqency));
						app.bufferSources.push(bufferSource);
					});
					btnOkElem.addEventListener('click', () => {
						if (!item.isCorrect) {
							app.state = AppState.GAMEOVER;
							App.update(app);
							return;
						}
						app.state = AppState.RESULT;
						App.update(app);
					});
				});

				{
					const item = quest.subject;
					const note = NOTE_DATA[item.noteId];
					const btnPlayElem = document.getElementById('btn-play-a');
					btnPlayElem.addEventListener('click', () => {
						App.stopSoundAll(app);
						var bufferSource = App.playSound(app.audioContext, App.getAudioBufferGenerator(item.shape)(app.audioContext, note.freqency));
						app.bufferSources.push(bufferSource);
					});
				}
				break;
			}
			case AppState.RESULT: {
				const html = `<div>${app.questLevel}問目</div>` +
					"<div>正解！</div>" +
					`<button id="btn-retry">次へ</button>`;

				app.contentElem.innerHTML = html;

				const btnElement = document.getElementById('btn-retry');
				btnElement.addEventListener('click', () => {
					app.questLevel += 1;
					app.state = AppState.SELECT;
					App.update(app);
				});

				break;
			}
			case AppState.GAMEOVER: {
				const html = `<div>${app.questLevel}問目</div>` +
					"<div>ゲームオーバー</div>" +
					`<button id="btn-retry">最初から</button>`;

				app.contentElem.innerHTML = html;

				const btnElement = document.getElementById('btn-retry');
				btnElement.addEventListener('click', () => {
					app.state = AppState.INIT;
					App.update(app);
				});

				break;
			}
		}
	}

	static getAudioBufferGenerator(name) {
		switch (name) {
			case 'pulse125': return AudioBufferGenerator.pulse125;
			case 'pulse25': return AudioBufferGenerator.pulse25;
			case 'tri': return AudioBufferGenerator.tri;
			case 'square': return AudioBufferGenerator.square;
			default:
				throw "name: " + name;
		}
	}
}

class AudioBufferGenerator {
	static fuga(audioContext, key, f) {
		// AudioaudioContextのサンプルレートで2秒間の空のステレオバッファを生成する
		const channels = 1;
		const sec = 0.5;
		const frameCount = audioContext.sampleRate * sec;
		const cycleFC = Math.floor(audioContext.sampleRate / key);
		const cycleHalfFC = Math.floor(cycleFC / 2);
		const myArrayBuffer = audioContext.createBuffer(channels, frameCount, audioContext.sampleRate);

		const align = 8;

		// バッファにホワイトノイズを書き込む;
		// 単なる-1.0から1.0の間の乱数の値である
		for (var channel = 0; channel < channels; channel++) {
			// 実際のデータの配列を得る
			var nowBuffering = myArrayBuffer.getChannelData(channel);
			for (var i = 0; i < frameCount; i++) {
				const t1 = (i % cycleFC) / cycleFC;
				nowBuffering[i] = f(t1) * 0.25;
			}
		}

		return myArrayBuffer;
	}

	static square(audioContext, key) {
		return AudioBufferGenerator.pulse(audioContext, key, 0.5);
	}

	static pulse25(audioContext, key) {
		return AudioBufferGenerator.pulse(audioContext, key, 0.25);
	}

	static pulse125(audioContext, key) {
		return AudioBufferGenerator.pulse(audioContext, key, 0.125);
	}

	static pulse(audioContext, key, ratio) {
		return AudioBufferGenerator.fuga(audioContext, key, (t) => {
			const v = (t < ratio) ? -1 : 1;
			return v;
		});
	}

	static tri(audioContext, key) {
		return AudioBufferGenerator.fuga(audioContext, key, (t1) => {
			const align = 8;
			const t2 = (t1 < 0.5) ?
				t1 * 2 :
				(1.0 - t1) * 2;
			const v = LerpUtil.linear(-1, 1, t2);
			return Math.floor(v * align) / align;
		});
	}

	static whiteNoise(audioContext) {
		return AudioBufferGenerator.fuga(audioContext, key, (t) => {
			const align = 8;
			const v = Math.random() * 2 - 1;
			return Math.floor(v * align) / align;
		});
	}

}

class QuestGenerator {
	static shuffle(arr) {
		for (var i = 0; i < arr.length; i++) {
			const j = Math.floor(Math.random() * arr.length);
			const tmp = arr[i];
			arr[i] = arr[j];
			arr[j] = tmp;
		}
	}

	static generate(level) {

		let tmpl = {};
		if (level < 2) {
			tmpl = {
				baseAnsers: [
					{
						noteId: 69,
					},
					{
						noteId: 69 + 3,
					},
					{
						noteId: 69 + 6,
					},
				],
				shape: 'pulse25',
				isShuffle: false,
				isMultiShape: false,
				shiftRange: 12,
			};
		} else if (level < 3) {
			tmpl = {
				baseAnsers: [
					{
						noteId: 69,
					},
					{
						noteId: 69 + 3,
					},
					{
						noteId: 69 + 6,
					},
					{
						noteId: 69 + 9,
					},
				],
				shape: 'pulse125',
				isShuffle: false,
				isMultiShape: false,
				shiftRange: 12,
			};
		} else if (level < 4) {
			tmpl = {
				baseAnsers: [
					{
						noteId: 57,
					},
					{
						noteId: 57 + 3,
					},
					{
						noteId: 57 + 6,
					},
					{
						noteId: 57 + 9,
					},
				],
				shape: 'tri',
				isShuffle: false,
				isMultiShape: false,
				shiftRange: 12,
			};
		} else if (level < 5) {
			tmpl = {
				baseAnsers: [
					{
						noteId: 69,
					},
					{
						noteId: 69 + 2,
					},
					{
						noteId: 69 + 4,
					},
					{
						noteId: 69 + 6,
					},
				],
				shape: 'square',
				isShuffle: false,
				isMultiShape: false,
				shiftRange: 12,
			};
		} else {
			tmpl = {
				baseAnsers: [
					{
						noteId: 69,
					},
					{
						noteId: 69 + 1,
					},
					{
						noteId: 69 + 2,
					},
					{
						noteId: 69 + 3,
					},
					{
						noteId: 69 + 4,
					},
				],
				shape: 'random',
				isShuffle: true,
				isMultiShape: true,
				shiftRange: 36,
			};
		}

		const shift = Math.floor((Math.random() * tmpl.shiftRange) - tmpl.shiftRange / 2);
		const correctIndex = Math.floor(Math.random() * tmpl.baseAnsers.length);
		let shape = tmpl.shape;
		const shapes = [
			'pulse125',
			'pulse25',
			'square',
			'tri',
		];
		QuestGenerator.shuffle(shapes);
		if (tmpl.shape === 'random') {
			shape = shapes.shift();
		} else {
			const shapeIndex = shapes.indexOf(shape);
			shapes.splice(shapeIndex, 1);
		}
		const subjectShape =  tmpl.isMultiShape ?
			shapes.shift() :
			shape;


		const answerArr = [];

		tmpl.baseAnsers.forEach((baseAnswer, i) => {
			const noteId = baseAnswer.noteId + shift;
			answerArr.push({
				noteId: noteId,
				shape: shape,
				isCorrect: i === correctIndex,
			});
		});

		let shapeName = '';
		switch (shape) {
			case 'tri': shapeName = '三角波'; break;
			case 'square': shapeName = '矩形波'; break;
			case 'pulse125': shapeName = '12.5%パルス波'; break;
			case 'pulse25': shapeName = '25%パルス波'; break;
		}

		let description = '';
		if (tmpl.isMultiShape) {
			description = `「${shapeName}」<br>この音と同じ音程の音はどれ？`;
		} else {
			description = `「${shapeName}」<br>この音と同じ音はどれ？`;
		}

		const subject = {
			noteId: answerArr[correctIndex].noteId,
			shape: subjectShape,
			description: description,
		};

		if (tmpl.isShuffle) {
			QuestGenerator.shuffle(answerArr);
		}

		const quest = {
			subject: subject,
			answerArr: answerArr,
		};

		return quest;
	}
}

class LerpUtil {
	static linear(a, b, t) {
		return a + (b - a) * t;
	}
}

var app = null;
window.addEventListener('load', async () => {
	// 読み込み完了後にボタンにクリックイベントを登録
	const contentElem = document.getElementById('content');
	var btn = document.getElementById('btn');
	btn.onclick = async () => {
		if (!app) {
			app = new App();
			App.update(app);

			// // サウンドを読み込む
			// try {
			// 	app.seBuffer = await App.getAudioBuffer(app.audioContext, 'se.mp3');
			// } catch (error) {
			// 	console.log('error: ' + error);
			// }

		}
	};
});


class Note {
	constructor(id, name, freqency) {
		this.id = id;
		this.name = name;
		this.freqency = freqency;
	}
}

const NOTE_ARR = [
	["C-1", "C-2", 0, 8.176],
	["C#/D♭-1", "C#/D♭-2", 1, 8.662],
	["D-1", "D-2", 2, 9.177],
	["D#/E♭-1", "D#/E♭-2", 3, 9.723],
	["E-1", "E-2", 4, 10.301],
	["F-1", "F-2", 5, 10.913],
	["F#/G♭-1", "F#/G♭-2", 6, 11.562],
	["G-1", "G-2", 7, 12.25],
	["G#/A♭-1", "G#/A♭-2", 8, 12.978],
	["A-1", "A-2", 9, 13.75],
	["A#/B♭-1", "A#/B♭-2", 10, 14.568],
	["B-1", "B-2", 11, 15.434],
	["C0", "C-1", 12, 16.352],
	["C#/D♭0", "C#/D♭-1", 13, 17.324],
	["D0", "D-1", 14, 18.354],
	["D#/E♭0", "D#/E♭-1", 15, 19.445],
	["E0", "E-1", 16, 20.602],
	["F0", "F-1", 17, 21.827],
	["F#/G♭0", "F#/G♭-1", 18, 23.125],
	["G0", "G-1", 19, 24.5],
	["G#/A♭0", "G#/A♭-1", 20, 25.957],
	["A0", "A-1", 21, 27.5],
	["A#/B♭0", "A#/B♭-1", 22, 29.135],
	["B0", "B-1", 23, 30.868],
	["C1", "C0", 24, 32.703],
	["C#/D♭1", "C#/D♭0", 25, 34.648],
	["D1", "D0", 26, 36.708],
	["D#/E♭1", "D#/E♭0", 27, 38.891],
	["E1", "E0", 28, 41.203],
	["F1", "F0", 29, 43.654],
	["F#/G♭1", "F#/G♭0", 30, 46.249],
	["G1", "G0", 31, 48.999],
	["G#/A♭1", "G#/A♭0", 32, 51.913],
	["A1", "A0", 33, 55],
	["A#/B♭1", "A#/B♭0", 34, 58.27],
	["B1", "B0", 35, 61.735],
	["C2", "C1", 36, 65.406],
	["C#/D♭2", "C#/D♭1", 37, 69.296],
	["D2", "D1", 38, 73.416],
	["D#/E♭2", "D#/E♭1", 39, 77.782],
	["E2", "E1", 40, 82.407],
	["F2", "F1", 41, 87.307],
	["F#/G♭2", "F#/G♭1", 42, 92.499],
	["G2", "G1", 43, 97.999],
	["G#/A♭2", "G#/A♭1", 44, 103.826],
	["A2", "A1", 45, 110],
	["A#/B♭2", "A#/B♭1", 46, 116.541],
	["B2", "B1", 47, 123.471],
	["C3", "C2", 48, 130.813],
	["C#/D♭3", "C#/D♭2", 49, 138.591],
	["D3", "D2", 50, 146.832],
	["D#/E♭3", "D#/E♭2", 51, 155.563],
	["E3", "E2", 52, 164.814],
	["F3", "F2", 53, 174.614],
	["F#/G♭3", "F#/G♭2", 54, 184.997],
	["G3", "G2", 55, 195.998],
	["G#/A♭3", "G#/A♭2", 56, 207.652],
	["A3", "A2", 57, 220],
	["A#/B♭3", "A#/B♭2", 58, 233.082],
	["B3", "B2", 59, 246.942],
	["C4", "C3", 60, 261.626],
	["C#/D♭4", "C#/D♭3", 61, 277.183],
	["D4", "D3", 62, 293.665],
	["D#/E♭4", "D#/E♭3", 63, 311.127],
	["E4", "E3", 64, 329.628],
	["F4", "F3", 65, 349.228],
	["F#/G♭4", "F#/G♭3", 66, 369.994],
	["G4", "G3", 67, 391.995],
	["G#/A♭4", "G#/A♭3", 68, 415.305],
	["A4", "A3", 69, 440],
	["A#/B♭4", "A#/B♭3", 70, 466.164],
	["B4", "B3", 71, 493.883],
	["C5", "C4", 72, 523.251],
	["C#/D♭5", "C#/D♭4", 73, 554.365],
	["D5", "D4", 74, 587.33],
	["D#/E♭5", "D#/E♭4", 75, 622.254],
	["E5", "E4", 76, 659.255],
	["F5", "F4", 77, 698.456],
	["F#/G♭5", "F#/G♭4", 78, 739.989],
	["G5", "G4", 79, 783.991],
	["G#/A♭5", "G#/A♭4", 80, 830.609],
	["A5", "A4", 81, 880],
	["A#/B♭5", "A#/B♭4", 82, 932.328],
	["B5", "B4", 83, 987.767],
	["C6", "C5", 84, 1046.502],
	["C#/D♭6", "C#/D♭5", 85, 1108.731],
	["D6", "D5", 86, 1174.659],
	["D#/E♭6", "D#/E♭5", 87, 1244.508],
	["E6", "E5", 88, 1318.51],
	["F6", "F5", 89, 1396.913],
	["F#/G♭6", "F#/G♭5", 90, 1479.978],
	["G6", "G5", 91, 1567.982],
	["G#/A♭6", "G#/A♭5", 92, 1661.219],
	["A6", "A5", 93, 1760],
	["A#/B♭6", "A#/B♭5", 94, 1864.655],
	["B6", "B5", 95, 1975.533],
	["C7", "C6", 96, 2093.005],
	["C#/D♭7", "C#/D♭6", 97, 2217.461],
	["D7", "D6", 98, 2349.318],
	["D#/E♭7", "D#/E♭6", 99, 2489.016],
	["E7", "E6", 100, 2637.02],
	["F7", "F6", 101, 2793.826],
	["F#/G♭7", "F#/G♭6", 102, 2959.955],
	["G7", "G6", 103, 3135.963],
	["G#/A♭7", "G#/A♭6", 104, 3322.438],
	["A7", "A6", 105, 3520],
	["A#/B♭7", "A#/B♭6", 106, 3729.31],
	["B7", "B6", 107, 3951.066],
	["C8", "C7", 108, 4186.009],
	["C#/D♭8", "C#/D♭7", 109, 4434.922],
	["D8", "D7", 110, 4698.636],
	["D#/E♭8", "D#/E♭7", 111, 4978.032],
	["E8", "E7", 112, 5274.041],
	["F8", "F7", 113, 5587.652],
	["F#/G♭8", "F#/G♭7", 114, 5919.911],
	["G8", "G7", 115, 6271.927],
	["G#/A♭8", "G#/A♭7", 116, 6644.875],
	["A8", "A7", 117, 7040],
	["A#/B♭8", "A#/B♭7", 118, 7458.62],
	["B8", "B7", 119, 7902.133],
	["C9", "C8", 120, 8372.018],
	["C#/D♭9", "C#/D♭8", 121, 8869.844],
	["D9", "D8", 122, 9397.273],
	["D#/E♭9", "D#/E♭8", 123, 9956.063],
	["E9", "E8", 124, 10548.082],
	["F9", "F8", 125, 11175.303],
	["F#/G♭9", "F#/G♭8", 126, 11839.822],
	["G9", "G8", 127, 12543.854],
];

NOTE_DATA = [];
for (var i = 0; i < NOTE_ARR.length; i++) {
	const item = NOTE_ARR[i];
	const note = new Note(item[2], item[0], item[3]);
	NOTE_DATA[note.id] = note;
}

