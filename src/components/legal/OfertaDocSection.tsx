import React from 'react';
import { FileText, Sparkles, CreditCard, RefreshCw, ShieldCheck, Globe } from 'lucide-react';

export default function OfertaDocSection() {
  return (
    <div className="space-y-4 text-[14px] leading-relaxed text-slate-900 break-words">
      {/* Header Block */}
      <div className="rounded-2xl p-4 sm:p-5 border-2 border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2">
        <div className="text-[14px] font-bold text-pink-700">
          Официальный документ · Общество с ограниченной ответственностью «РентРоп»
        </div>
        <h2 className="text-[17px] sm:text-[19px] font-extrabold bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent leading-snug">
          Публичная оферта на предоставление доступа к сервису «ИИSMM» с разделом о рекуррентных платежах
        </h2>
        <p className="text-[14px] text-slate-800 font-medium">
          Действующая редакция для официальных доменов https://iismm.online и https://iismm.ru · Заключается в соответствии со статьями 429.4, 435, 437, 438 и 1286 Гражданского кодекса Российской Федерации.
        </p>
      </div>

      {/* Section 1 */}
      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <FileText className="w-4 h-4 text-pink-600 shrink-0" />
          <span>1. Термины, предмет оферты и порядок акцепта</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>1.1. Сервис «ИИSMM»</strong> — облачная программная платформа для создания текстового и графического контента, планирования публикаций, запуска автосценариев и публикации материалов в социальные сети и мессенджеры, расположенная в сети Интернет по адресам <strong>https://iismm.online</strong> и <strong>https://iismm.ru</strong>, а также в приложении Telegram (@IIrkiBot).
        </p>
        <p className="text-slate-900 font-medium">
          <strong>1.2. Лицензиар (Исполнитель)</strong> — Общество с ограниченной ответственностью «РентРоп» (ОГРН 1217700234157, ИНН 7726477438, КПП 772601001), применяющее общую систему налогообложения с исчислением и уплатой налога на добавленную стоимость по ставке 5% (пять процентов) согласно Налоговому кодексу Российской Федерации.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>1.3. Акцепт оферты (ст. 438 ГК РФ)</strong> — регистрация или авторизация Пользователя в Сервисе, оплата подписки на тарифный план либо пополнение баланса виртуальных единиц через платежный сервис Робокасса (Robokassa).
        </p>
      </div>

      {/* Section 2 */}
      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <Sparkles className="w-4 h-4 text-pink-600 shrink-0" />
          <span>2. Условия подписки, расчетный период и стоимость тарифов</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>2.1. Период действия подписки:</strong> стандартный расчетный период ежемесячной подписки составляет <strong>30 (тридцать) календарных дней</strong> (1 месяц) с момента подтверждения оплаты. Также доступна единовременная предоплата на периоды 90 дней (3 месяца со скидкой 10%), 180 дней (6 месяцев со скидкой 15%) и 360 дней (12 месяцев со скидкой 20%).
        </p>
        <p className="text-slate-900 font-medium">
          <strong>2.2. Действующая стоимость тарифных планов (с учетом налога 5%):</strong>
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-900 font-medium">
          <li>
            <strong>Тариф «Старт»</strong> — 0 ₽ / мес (бесплатно, бессрочно, без привязки банковской карты): ежемесячное начисление 300 бонусных ИИрок, планировщик публикаций и базовые инструменты.
          </li>
          <li>
            <strong>Тариф «Разгон»</strong> — <strong>990 ₽ за 30 календарных дней</strong> (в том числе налог на добавленную стоимость 5%): пакет 990 ИИрок на расчетный период, фирменные стили, нейроплан и память прошлых публикаций.
          </li>
          <li>
            <strong>Тариф «Отрыв»</strong> — <strong>4 900 ₽ за 30 календарных дней</strong> (в том числе налог на добавленную стоимость 5%): пакет 4 900 ИИрок на расчетный период, конструктор каскадных сценариев, командный доступ и продвижение постов.
          </li>
          <li>
            <strong>Тариф «Космос»</strong> — индивидуальная договорная стоимость по счету или согласованию с корпоративным заказчиком (в том числе налог на добавленную стоимость 5%).
          </li>
        </ul>
        <p className="text-slate-900 font-medium">
          <strong>2.3. Отсутствие скрытых платежей:</strong> итоговая сумма к оплате отображается на странице оформления заказа до перехода в платежный шлюз. В Сервисе отсутствуют скрытые комиссии, сервисные сборы и автоматическое подключение дополнительных платных услуг без явного волеизъявления Пользователя.
        </p>
      </div>

      {/* Section 3 */}
      <div className="rounded-2xl p-4 sm:p-5 border border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-2.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <CreditCard className="w-4 h-4 text-orange-600 shrink-0" />
          <span>3. Виртуальные единицы «ИИрки» и номенклатура кассового чека 54-фз</span>
        </h3>
        <p className="text-slate-900 font-medium">
          <strong>3.1. Курс и назначение:</strong> 1 российский рубль (1 ₽) равен 1 виртуальной учетной единице («ИИрка»). Оплаченные ИИрки не сгорают по времени и используются для учета генерации контента и оплаты функций внутри Сервиса.
        </p>
        <p className="text-slate-900 font-medium">
          <strong>3.2. Фискализация чеков по закону № 54-фз через Робокассу:</strong> при каждой оплате формируется электронный фискальный чек с отправкой на электронную почту Пользователя:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-slate-900 font-medium">
          <li>
            При разовом пополнении баланса: наименование позиции <strong>«Виртуальные единицы ИИрки»</strong>, количество равно числу приобретаемых ИИрок, без налога на добавленную стоимость (<strong>null</strong>).
          </li>
          <li>
            При оформлении ежемесячной подписки на 1 месяц и при рекуррентных списаниях: <strong>«Ежемесячная подписка на тариф «Разгон» сервиса ИИSMM»</strong> или <strong>«Ежемесячная подписка на тариф «Отрыв» сервиса ИИSMM»</strong>, количество — 1 месяц, ставка налога 5% (<strong>vat5</strong>).
          </li>
          <li>
            При оплате тарифа на 3, 6 или 12 месяцев: <strong>«Подписка на тариф «Разгон» сервиса ИИSMM»</strong> или <strong>«Подписка на тариф «Отрыв» сервиса ИИSMM»</strong>, количество равно числу оплачиваемых месяцев, ставка налога 5% (<strong>vat5</strong>).
          </li>
        </ul>
      </div>

      {/* Section 4: Mandatory Robokassa Recurrent Payments Section */}
      <div className="rounded-2xl p-4 sm:p-5 border-2 border-pink-400 bg-gradient-to-r from-sky-100/80 via-pink-100/80 via-orange-100/80 via-pink-100/80 to-sky-100/80 backdrop-blur-md space-y-3">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 border-b border-pink-300 pb-2">
          <RefreshCw className="w-4 h-4 text-sky-600 shrink-0" />
          <span>4. Рекуррентные платежи (автоматическое продление подписки), отмена, возврат и изменение цены</span>
        </h3>

        <p className="text-slate-900 font-medium">
          <strong>4.1. Добровольное согласие и фиксация в базе данных:</strong> подключение рекуррентных (автоматических) списаний по абонентскому договору (ст. 429.4 ГК РФ) осуществляется исключительно при самостоятельной установке Пользователем отметки в чекбоксе <strong>«Я согласен на автоматические списания согласно условиям оферты»</strong> на форме оплаты (по умолчанию чекбокс не отмечен). Сервис сохраняет в базе данных запись о данном согласии (идентификатор пользователя, тариф, сумма, периодичность, дата и время согласия, сетевой адрес и номер счета).
        </p>

        <p className="text-slate-900 font-medium">
          <strong>4.2. Порядок, периодичность и сроки списаний:</strong> первое списание в размере полной стоимости выбранного тарифа (990 ₽ для тарифа «Разгон» либо 4 900 ₽ для тарифа «Отрыв») производится в момент оформления заказа Пользователем. Последующие автоматические списания производятся безакцептно через защищенный шлюз Робокассы с привязанной банковской карты строго <strong>1 (один) раз каждые 30 (тридцать) календарных дней</strong> от даты предыдущей успешной оплаты в расчетном интервале с <strong>09:00 до 12:00 по московскому времени</strong>. За 24–72 часа до даты очередного списания Сервис направляет Пользователю предварительное напоминание в Личном кабинете и/или в Telegram. Полные реквизиты банковской карты хранятся исключительно на стороне платежного оператора Робокасса по стандарту безопасности платежных карт и Лицензиару не передаются.
        </p>

        <p className="text-slate-900 font-medium">
          <strong>4.3. Свободная отмена подписки без препятствий:</strong> Пользователь вправе в любой момент самостоятельно и без каких-либо штрафов, комиссий, удержаний или объяснения причин отключить рекуррентные списания одним из способов на свой выбор:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-slate-900 font-medium">
          <li>
            <strong>В 1 клик в Личном кабинете:</strong> раздел «Тарифы» → переключатель «Автопродление» (отключение вступает в силу мгновенно в момент нажатия);
          </li>
          <li>
            <strong>По обращению в поддержку:</strong> направив письмо в свободной форме на <a href="mailto:info@arenda-ropa.com" className="text-pink-700 font-bold underline">info@arenda-ropa.com</a> или сообщение в бот <a href="https://t.me/IIrkiBot" target="_blank" rel="noopener noreferrer" className="text-sky-700 font-bold underline">@IIrkiBot</a> не позднее чем за 24 часа до плановой даты списания.
          </li>
        </ul>
        <p className="text-slate-900 font-medium">
          После отмены автопродления последующие списания полностью прекращаются, а доступ к уже оплаченному тарифу сохраняется до окончания текущего оплаченного 30-дневного периода, после чего аккаунт автоматически переводится на бесплатный тариф «Старт».
        </p>

        <p className="text-slate-900 font-medium">
          <strong>4.4. Порядок возврата денежных средств:</strong> Пользователь вправе обратиться за возвратом денежных средств в соответствии с Законом Российской Федерации № 2300-1 «О защите прав потребителей» и статьей 782 ГК РФ, направив заявление в свободной форме на электронную почту <a href="mailto:info@arenda-ropa.com" className="text-pink-700 font-bold underline">info@arenda-ropa.com</a> с указанием идентификатора аккаунта (или электронной почты), даты платежа и номера заказа. Заявление рассматривается Лицензиаром в срок до <strong>10 (десяти) рабочих дней</strong>. При отказе от подписки возврату подлежит сумма за неиспользованный остаток оплаченного периода (за вычетом стоимости фактически оказанных услуг и израсходованных единиц). Перечисление возврата осуществляется тем же способом на банковскую карту, с которой была произведена оплата, через платежный шлюз Робокассы с формированием чека возврата прихода по 54-фз.
        </p>

        <p className="text-slate-900 font-medium">
          <strong>4.5. Условия изменения стоимости подписки:</strong> Лицензиар не вправе увеличивать сумму рекуррентного списания в одностороннем порядке без предварительного уведомления Пользователя. В случае изменения тарифов Лицензиар публикует обновленную редакцию Оферты и направляет Пользователям активных подписок персональное уведомление не менее чем за <strong>14 (четырнадцать) календарных дней</strong> до начала следующего расчетного периода (по электронной почте, в Личном кабинете и/или через Telegram-бот). Стоимость уже оплаченного текущего периода изменению не подлежит. Если Пользователь не согласен с новой ценой, он вправе в один клик отключить автопродление до даты очередного списания.
        </p>

        <div className="p-3.5 rounded-xl border border-pink-400 bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 flex items-start gap-2.5">
          <Globe className="w-5 h-5 text-pink-600 shrink-0 mt-0.5" />
          <p className="text-slate-900 font-bold text-[14px]">
            4.6. Ограничение по иностранным банковским картам: прием рекуррентных оплат по иностранной карте не доступен. Для оформления и автоматического продления подписки принимаются банковские карты платежных систем «Мир», Visa и Mastercard, выпущенные банками Российской Федерации.
          </p>
        </div>
      </div>

      {/* Section 5: Requisites */}
      <div className="rounded-2xl p-4 sm:p-5 border-2 border-pink-400 bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md space-y-1.5">
        <h3 className="font-extrabold text-[15px] bg-gradient-to-r from-sky-600 via-pink-600 via-orange-500 via-pink-600 to-sky-600 bg-clip-text text-transparent flex items-center gap-2 pb-1">
          <ShieldCheck className="w-4 h-4 text-pink-600 shrink-0" />
          <span>5. Реквизиты Лицензиара</span>
        </h3>
        <p className="font-bold text-slate-900">Общество с ограниченной ответственностью «РентРоп»</p>
        <p className="text-slate-900 font-medium"><strong>Юридический адрес:</strong> 115191, г. Москва, пер. Духовской, д. 17, стр. 15, помещ. 11Н/2</p>
        <p className="text-slate-900 font-medium"><strong>ОГРН:</strong> 1217700234157 · <strong>ИНН:</strong> 7726477438 · <strong>КПП:</strong> 772601001</p>
        <p className="text-slate-900 font-medium"><strong>Система налогообложения:</strong> Общая система налогообложения (налог на добавленную стоимость 5%)</p>
        <p className="text-slate-900 font-medium">
          <strong>Служба поддержки и возвратов:</strong>{' '}
          <a href="mailto:info@arenda-ropa.com" className="text-pink-700 font-bold underline">info@arenda-ropa.com</a> · Telegram:{' '}
          <a href="https://t.me/IIrkiBot" target="_blank" rel="noopener noreferrer" className="text-sky-700 font-bold underline">@IIrkiBot</a>
        </p>
      </div>
    </div>
  );
}
