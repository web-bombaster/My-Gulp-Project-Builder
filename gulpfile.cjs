'use strict';

const { src, dest, watch, series, parallel } = require('gulp'),
	path = require('path'),
	browserSync = require('browser-sync'), // локальный сервер, синхронизация
	// watch = require('gulp-watch'), // для отслеживания изменений в файлах
	pug = require('gulp-pug'),
	includer = require('gulp-x-includer'),
	sourcemaps = require('gulp-sourcemaps'),
	sass = require('gulp-sass')(require('sass')),
	autoprefixer = require('gulp-autoprefixer').default,
	gcmq = require('gulp-group-css-media-queries'),
	csscomb = require('gulp-csscomb'), // Можно сконфигурировать причесывалку тут http://csscomb.com/config
	cleanCSS = require('gulp-clean-css'), // сжимаем css
	concat = require('gulp-concat'), // объединяем в файл
	rename = require('gulp-rename'),
	terser = require('gulp-terser'), // сжимаем скрипты
	del = require('del'), // для очистки папок, удаления файлов
	cache = require('gulp-cache'),
	newer = require('gulp-newer'),
	ftp = require('vinyl-ftp'), // выгрузка на сервер
	sharp = require('sharp'),
	rev = require('gulp-rev').default,
	revRewrite = require('gulp-rev-rewrite').default,
	through2 = require('through2'),
	plumber = require('gulp-plumber'), // сообщения при ошибках
	notify = require('gulp-notify'), // сообщения при ошибках
	fs = require('fs'); // это не отдельная установленная зависимость, а это встроено в npm

const folderProject = 'gorman-main2'; // имя папки конкретного проекта
const pathToAllProjects = 'D:/verstka/'; // путь до папки со всеми проектами

const pathToSrc = path.join(pathToAllProjects, folderProject, 'src'); // получаем путь до исходников проекта
const pathToBuild = path.join(pathToAllProjects, folderProject, 'dist'); // получаем путь до папки билда

	// ======================
// Конфиг путей
// ======================

var config = {
	// указываем источник для каждого типа
	source: {
		html: pathToBuild + '/index.html',
		pug: pathToSrc + '/pug/pages/index.pug',
		sass: pathToSrc + '/sass/**/*.+(scss|sass)',
		js: pathToSrc + '/js/common.js', // тут собираем в кучу свои скрипты
		libs: pathToSrc + '/libs/libs-includ.js', // инклюдим все js библиотеки, а потом инклюдим собранные свои скрипты
		libscopy: pathToSrc + '/assets/libs/**/*.*', // копируем файлы библиотек
		fonts: pathToSrc + '/assets/fonts/**/*.woff2',
		images: pathToSrc + '/assets/images/**/*.{jpg,jpeg,png}',
		svg: pathToSrc + '/assets/**/*.svg'
	},
	// указываем, куда будет делаться выгрузка
	build: {
		html: pathToBuild,
		css: pathToBuild + '/css/',
		js: pathToBuild + '/js/',
		libs: pathToBuild + '/js/',
		libscopy: pathToBuild + '/assets/libs/', // копируем файлы библиотек
		fonts: pathToBuild + '/assets/fonts/',
		fontsScss: pathToSrc + '/sass/base/_fonts.scss',
		images: pathToBuild + '/assets/images/',
		svg: pathToBuild + '/assets/'
	},
	// указываем, какие файлы будем отслеживать
	watch: {
		html: pathToBuild + '/*.html',
		pug: pathToSrc + '/pug/**/*.pug',
		sass: pathToSrc + '/sass/**/*.+(scss|sass)',
		js: pathToSrc + '/js/**/*.js',
		libs: [pathToSrc + '/libs/libs-includ.js', pathToBuild + '/js/common.min.js' ],
		fonts: pathToSrc + '/assets/fonts/**/*.woff2',
		images: pathToSrc + '/assets/images/**/*.{jpg,jpeg,png}',
		svg: pathToSrc + '/assets/**/*.svg'
	}
};

// Запуск локального сервера
function startServer() {
	browserSync.init({
		server: {
			// при простой верстке шаблона используем настройку server
			baseDir: pathToBuild
		},
		//port: 3002,
		// proxy: "domain.loc" // при интеграции gulp для работы с cms откдючаем настройку server и используем настройку proxy, в которой указываем локальный домен сайта
		notify: false
		// tunnel: true,
		// tunnel: "projectmane", //Demonstration page: http://projectmane.localtunnel.me
	});
}
exports.startServer = startServer;

// pug в html
function pugToHtml() {
	return src(config.source.pug)
		.pipe(
			pug({
				pretty: true
			})
		)
		.on(
			'error',
			notify.onError(function(error) {
				return 'Message to the notifier: ' + error.message;
			})
		)
		.pipe(dest(config.build.html))
		.pipe(browserSync.reload({ stream: true }))

}
exports.pugToHtml = pugToHtml;

// scss в css
function sassToCss() {
	return src(config.source.sass)
		.pipe(plumber())
		.pipe(sourcemaps.init()) // инициализация sourcemaps
		.pipe(sass().on('error', notify.onError())) // sass to css
		// .pipe(csscomb()) // причесали css - включать перед выгрузкой на проект, т.к. сбивает работу у sourcemaps
		.pipe(
			autoprefixer({
				cascade: false,
				flexbox: "no-2009"
			})
		)
		// .pipe(gcmq()) // включать перед выгрузкой на прокт, не сбивает работу у sourcemaps
		// .pipe(cleanCSS()) // Опционально, закомментировать при отладке - включать перед выгрузкой на проект, т.к. сбивает работу у sourcemaps
		.pipe(rename({ suffix: '.min', prefix: '' }))
		.pipe(sourcemaps.write('.')) // sourcemaps в dev-режиме

		.pipe(dest(config.build.css))
		.pipe(browserSync.reload({ stream: true }))
}
exports.sassToCss = sassToCss;

// common.js - инклюдим файлы скриптов, в которых инициализируем подключаемые библиотеки, пишем свои скрипты
function commonJs() {
	return src(config.source.js)
		.pipe(plumber())
		.pipe(includer()) // Комментируем, если работаем с версткой с простой структурой файлов
		.pipe(rename({ suffix: '.min', prefix: '' }))
		.pipe(dest(config.build.js))
}
exports.commonJs = commonJs;

// libs-includ.js - инклюдим js-библиотеки и common.js, получаем конечный scripts.min.js
function libsJs() {
	return src(config.source.libs)
		.pipe(plumber())
		.pipe(includer())
		// .pipe(terser()) // Включаем сжетие по необходимости
		.pipe(rename('scripts.min.js'))
		.pipe(dest(config.build.libs))
		.pipe(browserSync.reload({ stream: true }))
}
exports.libsJs = libsJs;

// Копирование библиотек
function copyLibs() {
	return src(config.source.libscopy)
		.pipe(dest(config.build.libscopy))
}
exports.copyLibs = copyLibs;

// Копирование шрифтов
function copyFons() {
	return src(config.source.fonts)
		.pipe(dest(config.build.fonts))
}
exports.copyFons = copyFons;

// Автоматическая генерация @font-face
function generateFonts(done) {

	const fontsDir = pathToSrc + '/assets/fonts/';
	const scssFile = pathToSrc + '/sass/base/_fonts.scss';

	if (!fs.existsSync(fontsDir)) {
		done();
		return;
	}

	const fontFiles = fs.readdirSync(fontsDir).filter(file => file.endsWith('.woff2'));

	if (fontFiles.length === 0) {
		done();
		return;
	}

	let fontFaceContent = '';

	fontFiles.forEach(file => {

		const fileName = file.replace('.woff2', '');
		const parts = fileName.split('-');

		const fontName = parts[0];
		const weightName = parts[1] || 'Regular';

		let fontWeight = 400;
		let fontStyle = 'normal';

		if (weightName.toLowerCase().includes('thin')) fontWeight = 100;
		else if (weightName.toLowerCase().includes('extralight')) fontWeight = 200;
		else if (weightName.toLowerCase().includes('light')) fontWeight = 300;
		else if (weightName.toLowerCase().includes('regular')) fontWeight = 400;
		else if (weightName.toLowerCase().includes('medium')) fontWeight = 500;
		else if (weightName.toLowerCase().includes('semibold')) fontWeight = 600;
		else if (weightName.toLowerCase().includes('bold')) fontWeight = 700;
		else if (weightName.toLowerCase().includes('extrabold')) fontWeight = 800;
		else if (weightName.toLowerCase().includes('black')) fontWeight = 900;

		if (weightName.toLowerCase().includes('italic')) fontStyle = 'italic';

		fontFaceContent += `
@font-face {
	font-family: "${fontName}";
	src: url("../assets/fonts/${file}") format("woff2");
	font-weight: ${fontWeight};
	font-style: ${fontStyle};
	font-display: swap;
}
`;
	});

	fs.writeFileSync(scssFile, fontFaceContent);

	done();
}
exports.generateFonts = generateFonts;

// Минификация графики jpg и png
function minImg() {
	return src(config.source.images, {
		encoding: false,
		base: pathToSrc
	})
		.pipe(through2.obj(function (file, _, cb) {

			if (!file.isBuffer()) return cb(null, file);

			const ext = path.extname(file.path).toLowerCase();

			if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {

				sharp(file.contents)
					.webp({ quality: 85 })
					.toBuffer()
					.then(data => {
						file.contents = data;
						file.path = file.path.replace(ext, '.webp');
						cb(null, file);
					})
					.catch(err => cb(err));

			} else {
				cb(null, file);
			}

		}))
		.pipe(rev())
		.pipe(dest(pathToBuild))
		.pipe(rev.manifest({
			path: 'rev-manifest.json',
			merge: false
		}))
		.pipe(dest(pathToBuild + '/rev'));
}
exports.minImg = minImg;

// Подмена ссылок на webp в HTML
function rewriteHtml() {

	const manifestPath = path.join(pathToBuild, 'rev/rev-manifest.json');

	if (!fs.existsSync(manifestPath)) {
		return Promise.resolve();
	}

	const manifest = JSON.parse(
		fs.readFileSync(manifestPath, 'utf8')
	);

	return src(config.build.html + '/*.html')
		.pipe(through2.obj(function (file, _, cb) {

			if (!file.isBuffer()) return cb(null, file);

			let html = file.contents.toString();

			// Ищем все src с png/jpg
			html = html.replace(
				/(src=["'])([^"']+\.(png|jpg|jpeg))(["'])/g,
				function (match, p1, imagePath, ext, p4) {

					const cleanPath = imagePath.replace(/^\//, '');
					const webpPath = cleanPath.replace(/\.(png|jpg|jpeg)$/i, '.webp');

					if (manifest[webpPath]) {
						return p1 + '/' + manifest[webpPath] + p4;
					}

					return match;
				}
			);

			file.contents = Buffer.from(html);
			cb(null, file);
		}))
		.pipe(dest(config.build.html));
}
exports.rewriteHtml = rewriteHtml;

// Удаление папки newbuild
function clean() {
	// return del(config.build.html); // работает
	return del([config.build.html + '/**'], { force: true });
}
exports.clean = clean;

// Отслеживание изменяемых вайлов
function startWatch() {
	watch(pathToSrc + '/pug/**/*.pug', pugToHtml);
	watch(config.source.sass, sassToCss);
	watch(config.watch.js, commonJs);
	watch(config.watch.libs, libsJs);
	watch(config.source.libscopy, copyLibs);
	watch(config.source.images, series(minImg, rewriteHtml));
	watch(config.source.fonts, copyFons);
}
exports.startWatch = startWatch;

// exports.default = series(
// 	commonJs, libsJs, generateFonts,
// 	parallel(pugToHtml, sassToCss, copyLibs, copyFons),
// 	minImg, rewriteHtml,
// 	parallel(startServer, startWatch)
// );

const build = series(
	commonJs,
	libsJs,
	generateFonts,
	parallel(pugToHtml, sassToCss, copyLibs, copyFons),
	minImg,
	rewriteHtml
);
exports.build = build;

const serve = series(
	build,
	parallel(startServer, startWatch)
);
exports.default = serve;