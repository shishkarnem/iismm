import React from 'react';
import { Scale, UserCheck, ShieldAlert } from 'lucide-react';

export default function UserAgreementSection() {
  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-slate-900 break-words">
      <div className="rounded-2xl p-4 sm:p-5 border-2 border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2">
        <div className="text-[14px] font-bold text-pink-700">
          Правила использования платформы · ООО «РентРоп»
        </div>
        <h2 className="text-[17px] sm:text-[19px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent leading-snug">
          Пользовательское соглашение платформы «ИИSMM»
        </h2>
        <p className="text-[14px] text-slate-800 font-medium">
          Регулирует порядок регистрации учетной записи, работы в Личном кабинете, генерации материалов с применением алгоритмов искусственного интеллекта и публикации контента на доменах https://iismm.online и https://iismm.ru.
        </p>
      </div>

      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <UserCheck className="w-4 h-4 text-sky-600 shrink-0" />
          <span>1. Регистрация учетной записи и доступ к Личному кабинету</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>1.1. Порядок регистрации:</strong> регистрация Пользователя осуществляется по адресу электронной почты либо через официальный бот и мини-приложение Telegram (@IIrkiBot). Пользователь обязуется указывать достоверный адрес электронной почты для получения уведомлений по подписке и кассовых чеков по закону № 54-фз.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>1.2. Безопасность учетной записи:</strong> Пользователь самостоятельно обеспечивает конфиденциальность своего пароля и сессии доступа. Все действия в Личном кабинете, включая подключение каналов, управление переключателем «Автопродление» и запуск сценариев, признаются совершенными самим Пользователем.
        </p>
      </div>

      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <Scale className="w-4 h-4 text-pink-600 shrink-0" />
          <span>2. Интеллектуальные права на создаваемые материалы</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>2.1. Права Пользователя на контент:</strong> все текстовые посты, сценарии и графические иллюстрации, созданные Пользователем с помощью инструментов Сервиса, предоставляются Пользователю для свободного личного и коммерческого использования в его каналах, блогах и рекламных проектах без выплаты дополнительного вознаграждения.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>2.2. Программный код Сервиса:</strong> исключительные права на программный комплекс «ИИSMM», дизайн интерфейса и базы данных принадлежат ООО «РентРоп» (ст. 1261 и 1286 ГК РФ).
        </p>
      </div>

      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <ShieldAlert className="w-4 h-4 text-orange-600 shrink-0" />
          <span>3. Допустимое использование, модерация и разрешение споров</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>3.1. Правила публикаций и отзывов:</strong> запрещается использовать Сервис для создания и распространения материалов, нарушающих законодательство Российской Федерации (включая спам-рассылки, мошеннические схемы, вредоносные ссылки, экстремистские материалы и нарушение прав третьих лиц). Публичные отзывы и комментарии проходят автоматическую нейросетевую и административную модерацию.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>3.2. Претензионный порядок:</strong> все обращения и претензии направляются в службу заботы по адресу{' '}
          <a href="mailto:info@arenda-ropa.com" className="text-pink-700 font-bold underline">info@arenda-ropa.com</a>. Срок рассмотрения обращения составляет до 10 рабочих дней.
        </p>
      </div>
    </div>
  );
}
