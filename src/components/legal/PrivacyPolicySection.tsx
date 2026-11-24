import React from 'react';
import { Lock, Database, ShieldCheck, Mail } from 'lucide-react';

export default function PrivacyPolicySection() {
  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-slate-900 break-words">
      <div className="rounded-2xl p-4 sm:p-5 border-2 border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2">
        <div className="text-[14px] font-bold text-pink-700">
          Защита конфиденциальной информации · Федеральный закон № 152-фз
        </div>
        <h2 className="text-[17px] sm:text-[19px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent leading-snug">
          Политика конфиденциальности и обработки персональных данных сервиса «ИИSMM»
        </h2>
        <p className="text-[14px] text-slate-800 font-medium">
          Настоящая Политика определяет порядок сбора, хранения, защиты и обработки персональных данных пользователей на официальных сайтах https://iismm.online и https://iismm.ru Оператором — ООО «РентРоп» (ОГРН 1217700234157, ИНН 7726477438).
        </p>
      </div>

      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <Database className="w-4 h-4 text-sky-600 shrink-0" />
          <span>1. Состав обрабатываемых данных и цели сбора</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>1.1. Категории данных:</strong> Оператор обрабатывает только минимально необходимые данные, которые Пользователь добровольно предоставляет при регистрации, авторизации и оплате услуг: имя или псевдоним, адрес электронной почты, идентификатор и имя профиля Telegram, технические файлы сессии (cookie, сетевой адрес и сведения о браузере), а также параметры оформленных подписок и согласий на рекуррентные списания.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>1.2. Безопасность платежных реквизитов:</strong> Оператор не собирает, не хранит и не обрабатывает полные номера банковских карт, сроки их действия или защитные коды. Ввод реквизитов карты происходит исключительно на защищенной платежной странице сервиса Робокасса по стандарту информационной безопасности платежных систем.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>1.3. Цели обработки:</strong> предоставление доступа к функционалу Личного кабинета, исполнение Договора публичной оферты, направление электронных фискальных чеков по закону № 54-фз, уведомление о предстоящих рекуррентных списаниях и оказание технической поддержки.
        </p>
      </div>

      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <Lock className="w-4 h-4 text-pink-600 shrink-0" />
          <span>2. Порядок хранения, локализация и передача третьим лицам</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>2.1. Локализация баз данных:</strong> запись, систематизация, накопление и хранение персональных данных граждан Российской Федерации осуществляются с использованием баз данных, расположенных на территории Российской Федерации, в соответствии с ч. 5 ст. 18 Федерального закона № 152-фз.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>2.2. Передача уполномоченным лицам:</strong> данные не передаются третьим лицам, за исключением случаев исполнения требований законодательства РФ и передачи адреса электронной почты и параметров заказа платежному сервису Робокасса и оператору фискальных данных для формирования кассового чека по 54-фз.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>2.3. Меры защиты:</strong> используются защищенное шифрованное соединение, хеширование паролей, разграничение прав доступа и журналирование операций с подписками.
        </p>
      </div>

      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
          <span>3. Права Пользователя, изменение и удаление данных</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>3.1. Права субъекта данных:</strong> Пользователь вправе получать сведения об обработке своих персональных данных, актуализировать их в настройках профиля, а также в любой момент отозвать согласие на обработку персональных данных и потребовать удаления учетной записи.
        </p>
        <p className="text-slate-900 font-medium flex flex-wrap items-center gap-1.5">
          <Mail className="w-4 h-4 text-pink-600 shrink-0" />
          <span>
            <strong>3.2. Контакты Оператора:</strong> запросы по вопросам конфиденциальности и прекращения обработки данных принимаются по адресу{' '}
            <a href="mailto:info@arenda-ropa.com" className="text-pink-700 font-bold underline">info@arenda-ropa.com</a> и рассматриваются в течение 10 рабочих дней.
          </span>
        </p>
      </div>
    </div>
  );
}
