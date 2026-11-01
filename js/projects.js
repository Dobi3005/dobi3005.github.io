/* ============================================================
   TYAF TEAM — данные сайта (проекты, новости, настройки)
   Этот файл читают И браузер, И server.js — поэтому тут
   единственное место, где нужно что-то добавлять/менять.
   ============================================================ */
(function (root, factory) {
  var data = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.TYAF = data;
})(typeof self !== 'undefined' ? self : this, function () {
  return {
    /* ---------- Общие настройки ---------- */
    SITE: {
      author: 'Dobi3005',          // автор сайта / новостей (можно поменять)
      team: 'TYAF TEAM',
      launchDate: '2026-10-31',    // дата открытия сайта
      subscribers: 125,            // число подписчиков (правь вручную)
      foundedYear: 2020,
      telegram: 'https://t.me/TYAF_TEAM_official',
      telegramDirect: 'https://t.me/TYAF_TEAM_official?direct',
      youtube: 'https://youtube.com/@dobi3005_?si=BdrAvyT2Pdr1QqR5',
      tiktok: 'https://www.tiktok.com/@tyaf.team?is_from_webapp=1&sender_device=pc'
    },

    /* ---------- Проекты ----------
       type: 'map' | 'mod' | 'texturepack' | 'other'
       file  — прямая ссылка на файл (лежит в public/downloads/)
       size  — размер файла в байтах (для подписи «53 МБ»)
       tg    — ссылка на пост в Telegram, откуда можно скачать
               (сейчас стоит общая ссылка на канал — замени на ссылку поста)
       video — трейлер/видео к проекту:
               src      — файл в public/videos/ (положи туда видео)
               youtube  — ИЛИ id ролика на YouTube (например 'dQw4w9WgXcQ')
       Тексты (название/описание/факт) лежат в js/i18n.js: p.<id>.title / desc / fact
    */
    PROJECTS: [
      {
        id: 'musicplayer',
        type: 'texturepack',
        date: '2026-11-01',
        author: 'TYAF TEAM',
        cover: 'img/tp1_1.webp',
        gallery: ['img/tp1_1.webp', 'img/tp1_2.webp', 'img/tp1_3.webp'],   // ← замени эти 3 файла своими скриншотами
        file: 'downloads/music-player.mcpack',
        size: 8621333,
        tg: 'https://t.me/TYAF_TEAM_official',                              // ← потом поставь ссылку на пост с файлом
        video: { src: 'videos/tp1.mp4', youtube: '', poster: 'img/tp1_1.webp' }   // ← замени videos/tp1.mp4 своим видео
      },
      {
        /* КАРТА «ЛЕДЯНОЙ ПРОРОК» — пока скрыта (hidden: true).
           Чтобы опубликовать: 1) перенеси файлы из папки _unpublished/ :
              _unpublished/downloads/map1.mcworld -> public/downloads/
              _unpublished/img/map1_*.webp        -> public/img/
           2) закинь видео в public/videos/lp.mp4
           3) поменяй hidden: true на hidden: false
           4) перезапусти сервер (на хостинге:  systemctl restart tyafteam) */
        id: 'map1',
        hidden: true,
        type: 'map',
        date: '2026-08-15',
        author: 'Dobi3005',
        cover: 'img/map1_cover.webp',
        gallery: [
          'img/map1_1.webp', 'img/map1_2.webp', 'img/map1_3.webp', 'img/map1_4.webp',
          'img/map1_5.webp', 'img/map1_6.webp', 'img/map1_7.webp'
        ],
        file: 'downloads/map1.mcworld',
        size: 55460453,
        tg: 'https://t.me/TYAF_TEAM_official',
        video: { src: 'videos/lp.mp4', youtube: '', poster: 'img/map1_cover.webp' }
      }
    ],

    /* ---------- Новости (сверху — самые свежие) ---------- */
    NEWS: [
      {
        id: 'site-launch',
        date: '2026-10-31',
        author: 'Dobi3005',
        icon: '✺',
        image: ''                    // картинка к новости (путь) — пусто = без картинки
      }
    ]
  };
});
