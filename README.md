# My-Gulp-Project-Builder
Мой текущий вариант Gulp-сборщика для верстки

## Особенности сборки

**Основная идея:** один сборщик у всех проектов, а не свой сборщик у каждого проекта. Экономим кучу места на диске.
При работе с проектом изменяем в `folderProject` имя папки проекта, чтобы в `pathToSrc` и `pathToBuild` получились правильные пути до исходников и продакшена.

Разные шаблоны сайтов будут лежать в папке со всеми проектами `/home/Boss/Documents/Verstka/src-projects` (путь можно переопределить в переменной `pathToAllProjects`).
У каждого шаблона будет своя папка. Внутри шаблона будут лежать папки `src` (для исходников) и `dist` (для продакшена).
Для переменной `folderProject` указываем только имя папки текущего проекта.
Таким образом, папки проектов будут полностью независимыми друг от друга и их можно будет загружать на Гитхаб вместе с исходниками. При этом настроенный сборщик для всех шаблонов будет использоваться один и тот же.

## Как запускать сборку

Создаем папку нового проекта внутри папки со всеми проектами `/home/Boss/Documents/Verstka/src-projects` . Внутри создаем папки `src` (для исходников) и `dist` (для продакшена).
Открываем папку проекта в редакторе.
Для запуска сборки в терминале сначала переходим к папке сборщика `/home/Boss/Documents/Verstka` . Сборщик может находиться и в любом другом месте на компьютере
`cd /home/Boss/Documents/Verstka`

`gulp clean` - для очистки папки продакшена
`gulp` - для запуска сборки
`gulp --tasks` - просмотр списка доступных задач (тасков)
