import React from 'react';
import { CheckCircle2, FileCheck2, ShieldCheck } from 'lucide-react';

export default function PersonalDataConsentSection() {
  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-slate-900 break-words">
      <div className="rounded-2xl p-4 sm:p-5 border-2 border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2">
        <div className="text-[14px] font-bold text-pink-700">
          Статья 9 Федерального закона № 152-фз «О персональных данных»
        </div>
        <h2 className="text-[17px] sm:text-[19px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent leading-snug">
          Согласие Пользователя на обработку персональных данных
        </h2>
        <p className="text-[14px] text-slate-800 font-medium">
          Действует при регистрации, авторизации, отправке форм обратной связи и оформлении подписок или платежей на сайтах https://iismm.online и https://iismm.ru.
        </p>
      </div>

      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <FileCheck2 className="w-4 h-4 text-pink-600 shrink-0" />
          <span>1. Предмет согласия и реквизиты Оператора</span>
        </h3>
        <p className="text-slate-900 font-medium">
          Настоящим я, действуя свободно, своей волей и в своем интересе, а также подтверждая свою дееспособность, даю согласие <strong>Обществу с ограниченной ответственностью «РентРоп»</strong> (ОГРН 1217700234157, ИНН 7726477438, КПП 772601001, юридический адрес: 115191, г. Москва, пер. Духовской, д. 17, стр. 15, помещ. 11Н/2) на автоматизированную и смешанную обработку моих персональных данных.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>Перечень персональных данных, на обработку которых дается согласие:</strong>
        </p>
        <ul className="list-disc pl-5 space-y-1 text-slate-900 font-medium">
          <li>имя, фамилия или выбранный псевдоним Пользователя;</li>
          <li>адрес электронной почты (в том числе для направления кассовых чеков по закону № 54-фз);</li>
          <li>идентификатор учетной записи и имя пользователя в мессенджере Telegram;</li>
          <li>технические сведения о сессии (сетевой адрес, файлы cookie, тип браузера, дата и время акцепта оферты и согласия на рекуррентные списания).</li>
        </ul>
      </div>

      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <CheckCircle2 className="w-4 h-4 text-sky-600 shrink-0" />
          <span>2. Цели и перечень действий с персональными данными</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>2.1. Цели обработки:</strong> создание и сопровождение учетной записи на платформе «ИИSMM», исполнение Договора публичной оферты, подключение тарифных планов и начисление виртуальных единиц «ИИрки», учет согласия на периодические рекуррентные платежи и его отзыва, формирование и отправка фискальных кассовых чеков через платежный сервис Робокасса и оператора фискальных данных, а также ответы на обращения в техническую поддержку.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>2.2. Действия с данными:</strong> сбор, запись, систематизация, накопление, хранение на серверах в Российской Федерации, уточнение (обновление, изменение), извлечение, использование, передача платежному агрегатору Робокасса в объеме, необходимом для проведения оплаты и фискализации чека, обезличивание, блокирование, удаление и уничтожение.
        </p>
      </div>

      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <ShieldCheck className="w-4 h-4 text-orange-600 shrink-0" />
          <span>3. Срок действия согласия и порядок его отзыва</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>3.1. Срок действия:</strong> настоящее Согласие действует с момента его предоставления на сайте или в приложении в течение всего срока использования учетной записи Пользователем и 3 (трех) лет после прекращения договорных отношений (для соблюдения сроков хранения первичных учетных и кассовых документов), либо до момента его отзыва Пользователем.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>3.2. Простой отзыв согласия:</strong> Согласие может быть отозвано Пользователем в любой момент путем направления письменного заявления в свободной форме на электронную почту Оператора{' '}
          <a href="mailto:info@arenda-ropa.com" className="text-pink-700 font-bold underline">info@arenda-ropa.com</a>. Оператор прекращает обработку и уничтожает персональные данные в срок, не превышающий 10 рабочих дней с даты поступления отзыва (за исключением сведений, обязательное хранение которых предусмотрено налоговым законодательством РФ).
        </p>
      </div>
    </div>
  );
}
