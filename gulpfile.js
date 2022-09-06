'use strict';

const folderProject = 'vozdushnye-shary'; // имя папки конкретного проекта
const pathToAllProjects = '/home/Boss/Documents/Verstka/src-projects/'; // путь до папки со всеми проектами

const pathToSrc = pathToAllProjects + folderProject + '/src'; // получаем путь до исходников проекта
const pathToBuild = pathToAllProjects + folderProject + '/dist'; // получаем путь до папки билда

// ======================
// Особенности сборки
// ======================

// Основная идея: один сборщик у всех проектов, а не свой сборщик у каждого проекта. Экономим кучу места на диске.
// При работе с проектом изменяем в folderProject имя папки проекта, чтобы в pathToSrc и pathToBuild получились правильные пути до исходников и продакшена.

// Разные шаблоны сайтов будут лежать в папке со всеми проектами /home/Boss/Documents/Verstka/src-projects (путь можно переопределить в переменной pathToAllProjects).
// У каждого шаблона будет своя папка. Внутри шаблона будут лежать папки src (для исходников) и dist (для продакшена).
// Для переменной folderProject указываем только имя папки текущего проекта.
// Таким образом, папки проектов будут полностью независимыми друг от друга и их можно будет загружать на Гитхаб вместе с исходниками. При этом настроенный сборщик для всех шаблонов будет использоваться один и тот же.

// ======================
// Как запускать сборку
// ======================

// Создаем папку нового проекта внутри папки со всеми проектами /home/Boss/Documents/Verstka/src-projects . Внутри создаем папки src (для исходников) и dist (для продакшена).
// Открываем папку проекта в редакторе.
// Для запуска сборки в терминале сначала переходим к папке сборщика /home/Boss/Documents/Verstka . Сборщик может находиться и в любом другом месте на компьютере
// cd /home/Boss/Documents/Verstka

// gulp clean // для очистки папки продакшена
// gulp // для запуска сборки
// gulp --tasks - просмотр списка доступных задач (тасков)

const { src, dest, watch, series, parallel } = require('gulp'),
	browserSync = require('browser-sync'), // локальный сервер, синхронизация
	// watch = require('gulp-watch'), // для отслеживания изменений в файлах
	pug = require('gulp-pug'),
	includer = require('gulp-x-includer'),
	gutil = require('gulp-util'),
	sourcemaps = require('gulp-sourcemaps'),
	smartgrid = require('smart-grid'),
	// sass = require('gulp-sass'),
	sass = require('gulp-sass')(require('sass')),
	autoprefixer = require('gulp-autoprefixer'),
	gcmq = require('gulp-group-css-media-queries'),
	csscomb = require('gulp-csscomb'), // Можно сконфигурировать причесывалку тут http://csscomb.com/config
	cleanCSS = require('gulp-clean-css'), // сжимаем css
	concat = require('gulp-concat'), // объединяем в файл
	rename = require('gulp-rename'),
	uglify = require('gulp-uglify'), // сжимаем скрипты
	del = require('del'), // для очистки папок, удаления файлов
	cache = require('gulp-cache'),
	newer = require('gulp-newer'),
	ftp = require('vinyl-ftp'), // выгрузка на сервер
	imagemin = require('gulp-imagemin'),
	plumber = require('gulp-plumber'), // сообщения при ошибках
	notify = require('gulp-notify'), // сообщения при ошибках
	fs = require('fs'); // это не отдельная установленная зависимость, а это встроено в npm

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
		libscopy: [ pathToSrc + '/libs/**/*.*', '!' + pathToSrc + '/libs/libs-includ.js' ], // копируем файлы библиотек
		fonts: pathToSrc + '/fonts/**/*.*',
		images: pathToSrc + '/img/**/*.{png,jpg,jpeg,svg,gif}',
		svg: pathToSrc + '/img/**/*.svg'
	},
	// указываем, куда будет делаться выгрузка
	build: {
		html: pathToBuild,
		css: pathToBuild + '/css/',
		js: pathToSrc + '/js/',
		libs: pathToBuild + '/js/',
		libscopy: pathToBuild + '/libs/', // копируем файлы библиотек
		fonts: pathToBuild + '/fonts/',
		images: pathToBuild + '/img/',
		svg: pathToBuild + '/img/'
	},
	// указываем, какие файлы будем отслеживать
	watch: {
		html: pathToBuild + '/*.html',
		pug: pathToSrc + '/pug/**/*.pug',
		sass: pathToSrc + '/sass/**/*.+(scss|sass)',
		js: [ pathToSrc + '/js/**/*.js', '!' + pathToSrc + '/js/common.min.js' ],
		js2: [ pathToSrc + '/libs/**/*.js', pathToSrc + '/js/common.min.js' ],
		libs: [ pathToSrc + '/libs/libs-includ.js', pathToSrc + '/js/common.min.js' ],
		images: pathToSrc + 'src/assets/img/**/*.{jpg,png,svg,gif,ico}',
		svg: pathToSrc + '/img/**/*.svg'
	}
};


exports.default = series(
	parallel(pugToHtml, sassToCss, copyLibs, copyFons, minImg),
	commonJs, libsJs,
	parallel(startServer, startWatch)
);

// Запуск локального сервера
function startServer() {
	browserSync({
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
		// .pipe(sourcemaps.init()) // инициализация sourcemaps
		.pipe(sass().on('error', notify.onError())) // sass to css
		.pipe(csscomb()) // причесали css - включать перед выгрузкой на проект, т.к. сбивает работу у sourcemaps
		.pipe(
			autoprefixer({
				// browsers: [ 'last 6 versions' ], устарело вроде
				overrideBrowserslist: [ 'last 6 versions' ],
				cascade: false
			})
	)
		.pipe(gcmq()) // включать перед выгрузкой на прокт, не сбивает работу у sourcemaps
		.pipe(cleanCSS()) // Опционально, закомментировать при отладке - включать перед выгрузкой на прокт, т.к. сбивает работу у sourcemaps
		.pipe(rename({ suffix: '.min', prefix: '' }))
		// .pipe(sourcemaps.write()) // sourcemaps покажет, какой файл используется

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
		// .pipe(browserSync.reload({ stream: true }))
}
exports.commonJs = commonJs;

// libs-includ.js - инклюдим js-библиотеки и common.js, получаем конечный scripts.min.js
function libsJs() {
	return src(config.source.libs)
		.pipe(plumber())
		.pipe(includer())
		.pipe(uglify())
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

// Минификация графики jpg и png
function minImg() {
	return src(config.source.images)
		.pipe(newer(config.build.images))
		.pipe(imagemin())
		.pipe(dest(config.build.images))
		.pipe(browserSync.reload({ stream: true }));
}
exports.minImg = minImg;

// Удаление папки newbuild
function clean() {
	// return del(config.build.html); // работает
	return del(config.build.html + '/**', {force:true});
}
exports.clean = clean;

// Отслеживание изменяемых вайлов
function startWatch() {
	watch(pathToSrc + '/pug/**/*.pug', pugToHtml);
	watch(config.source.sass, sassToCss);
	watch(config.watch.js, commonJs);
	watch(config.watch.js2, libsJs);
	watch(config.source.libscopy, copyLibs);
	watch(config.source.images, minImg);
}
exports.startWatch = startWatch;