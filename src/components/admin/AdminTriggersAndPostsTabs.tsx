import React, { useState } from 'react';
import {
  Activity,
  Clock,
  Edit3,
  FileText,
  MessageSquare,
  Play,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X
} from 'lucide-react';
import { GradientModalShell, ResponsiveActionBtn } from '../ui-kit/ResponsiveActionBtn';

const SYSTEM_TRIGGERS = [
  {
    name: 'on_publication_insert_log_activity',
    timing: 'после добавления',
    action: 'Запись события публикации и деталей доставки в журнал публикаций',
    status: 'Активен в базе',
    description: 'Автоматически фиксирует успешные и ошибочные отправки в каналы'
  },
  {
    name: 'auto_hash_user_passwords',
    timing: 'перед записью',
    action: 'Криптографическое хеширование пароля пользователя при сохранении',
    status: 'Активен в сервере',
    description: 'Обеспечивает безопасное хранение учетных данных профилей'
  },
  {
    name: 'cascade_delete_prompt_history',
    timing: 'перед удалением',
    action: 'Очистка связанных ссылок публикаций при удалении шаблона',
    status: 'Активен в базе',
    description: 'Поддерживает целостность внешних связей между таблицами'
  },
  {
    name: 'billing_on_post_published',
    timing: 'после отправки',
    action: 'Учет расхода Иирок при выполнении нейросетевых генераций и публикаций',
    status: 'Активен в тарифах',
    description: 'Автоматически обновляет баланс пользователя и журнал транзакций'
  }
];

interface AdminTriggersTabProps {
  dbCronList: any[];
  cronLoading: boolean;
  runningCronId: string | null;
  onRunCronTask: (cronId: string) => Promise<void>;
}

export const AdminTriggersTab: React.FC<AdminTriggersTabProps> = ({
  dbCronList,
  cronLoading,
  runningCronId,
  onRunCronTask
}) => {
  return (
    <div className="space-y-6 min-w-0">
      {/* Системные триггеры */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-pink-300/70 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Activity size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] sm:text-[18px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Мониторинг системных обработчиков базы
              </h3>
              <p className="text-[14px] text-slate-700 font-medium">
                Автоматические правила целостности, журналирования и расчетов
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SYSTEM_TRIGGERS.map((trigger) => (
              <div
                key={trigger.name}
                className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400"
              >
                <div className="h-full rounded-[14.5px] bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 p-4 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="text-[14px] font-semibold text-pink-700">
                      {trigger.timing} · {trigger.status}
                    </div>
                    <h4 className="text-[15px] font-bold text-slate-900 break-words">{trigger.name}</h4>
                    <p className="text-[14px] text-slate-700 leading-relaxed">{trigger.description}</p>
                  </div>
                  <div className="bg-white/80 p-2.5 rounded-xl border border-pink-200 text-[14px] text-slate-700 break-words">
                    {trigger.action}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Фоновые задачи по расписанию */}
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-6 space-y-5">
          <div className="flex items-center gap-3 border-b border-pink-300/70 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Clock size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-[16px] sm:text-[18px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                Расписание фоновых задач и сценариев
              </h3>
              <p className="text-[14px] text-slate-700 font-medium">
                Периодическая отправка публикаций, сценариев и резервных копий
              </p>
            </div>
          </div>

          <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 overflow-hidden">
            <div className="rounded-[14.5px] bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 overflow-x-auto">
              <table className="w-full text-left text-[14px] border-collapse">
                <thead className="bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border-b border-pink-300/70 text-slate-800 font-bold">
                  <tr>
                    <th className="p-3.5">Задача</th>
                    <th className="p-3.5">Расписание</th>
                    <th className="p-3.5">Последний запуск</th>
                    <th className="p-3.5">Следующий запуск</th>
                    <th className="p-3.5">Назначение</th>
                    <th className="p-3.5">Статус</th>
                    <th className="p-3.5 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pink-200/70 text-slate-800">
                  {dbCronList.length === 0 && !cronLoading ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-[14px] text-slate-600">
                        Список расписаний пуст.
                      </td>
                    </tr>
                  ) : (
                    dbCronList.map((task, i) => (
                      <tr key={task.id || i} className="hover:bg-white/60">
                        <td className="p-3.5 font-bold text-slate-900">
                          {task.title || task.id}
                          {task.item_type === 'backup' && (
                            <span className="ml-2 text-pink-700 font-semibold">· Резервная копия</span>
                          )}
                        </td>
                        <td className="p-3.5 font-semibold text-sky-700">
                          {task.schedule_human || task.cron_expression}
                        </td>
                        <td className="p-3.5 text-slate-700">
                          {task.last_run ? new Date(task.last_run).toLocaleString('ru-RU') : 'Еще не запускался'}
                        </td>
                        <td className="p-3.5 text-slate-700">
                          {task.next_run ? new Date(task.next_run).toLocaleString('ru-RU') : '—'}
                        </td>
                        <td className="p-3.5 text-slate-700">
                          {task.item_type === 'backup'
                            ? 'Отправка архива базы данных администратору'
                            : task.item_type === 'scenery'
                            ? 'Автоматический сценарий публикации'
                            : 'Автоматическая публикация постов'}
                        </td>
                        <td className="p-3.5 font-semibold text-pink-700">
                          {task.status === 'active' ? 'Активен' : task.status || 'Ожидание'}
                        </td>
                        <td className="p-3.5 text-right">
                          <ResponsiveActionBtn
                            icon={<Play size={16} />}
                            label={runningCronId === task.id ? 'Запуск...' : 'Запустить'}
                            disabled={runningCronId === task.id}
                            onClick={() => onRunCronTask(task.id)}
                            variant="vivid"
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AdminPostsDbTabProps {
  posts: any[];
  postsLoading: boolean;
  onRefreshPosts: () => Promise<void>;
  onEditPost?: (id: string) => void;
  onTestSendDM: (post: any) => Promise<void>;
  onPublishNow: (post: any) => Promise<void>;
  onConfirmDeletePost: (id: string, title: string) => Promise<void>;
}

export const AdminPostsDbTab: React.FC<AdminPostsDbTabProps> = ({
  posts,
  postsLoading,
  onRefreshPosts,
  onEditPost,
  onTestSendDM,
  onPublishNow,
  onConfirmDeletePost
}) => {
  const [postSearchTerm, setPostSearchTerm] = useState('');
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = posts.filter((p) => {
    const term = postSearchTerm.toLowerCase();
    return (
      (p.title || '').toLowerCase().includes(term) ||
      (p.postText || '').toLowerCase().includes(term)
    );
  });

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setIsDeleting(true);
    try {
      await onConfirmDeletePost(pendingDelete.id, pendingDelete.title);
      setPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-5 min-w-0">
      <div className="p-[1.5px] rounded-3xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 shadow-sm">
        <div className="rounded-[22.5px] bg-gradient-to-r from-sky-100/75 via-pink-100/75 via-orange-100/75 via-pink-100/75 to-sky-100/75 backdrop-blur-md p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-pink-300/70 pb-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-500 via-pink-500 via-orange-500 via-pink-500 to-sky-500 text-white flex items-center justify-center shrink-0 shadow-sm">
                <FileText size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-[16px] sm:text-[18px] font-bold bg-gradient-to-r from-sky-700 via-pink-600 via-orange-600 via-pink-600 to-sky-700 bg-clip-text text-transparent">
                  База публикаций и черновиков
                </h3>
                <p className="text-[14px] text-slate-700 font-medium">
                  Просмотр созданных постов, проверка расписаний и прямая отправка
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="flex-1 sm:w-64 p-[1.5px] rounded-xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400">
                <div className="flex items-center gap-2 rounded-[10.5px] bg-gradient-to-r from-sky-50/90 via-pink-50/90 via-orange-50/90 via-pink-50/90 to-sky-50/90 px-3 py-2">
                  <Search className="text-pink-600 shrink-0" size={16} />
                  <input
                    type="text"
                    value={postSearchTerm}
                    onChange={(e) => setPostSearchTerm(e.target.value)}
                    placeholder="Поиск по названию или тексту..."
                    className="w-full bg-transparent text-[14px] text-slate-900 focus:outline-none placeholder-slate-500"
                  />
                </div>
              </div>

              <ResponsiveActionBtn
                icon={<RefreshCw size={16} className={postsLoading ? 'animate-spin' : ''} />}
                label="Обновить"
                onClick={onRefreshPosts}
                variant="outline"
              />
            </div>
          </div>

          {postsLoading ? (
            <div className="py-10 text-center text-slate-700 text-[14px] font-medium">
              Загрузка таблицы публикаций из базы...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-slate-700 text-[14px] font-medium">
              Публикации не найдены.
            </div>
          ) : (
            <div className="p-[1.5px] rounded-2xl bg-gradient-to-r from-sky-400 via-pink-500 via-orange-400 via-pink-500 to-sky-400 overflow-hidden">
              <div className="rounded-[14.5px] bg-gradient-to-r from-sky-50/85 via-pink-50/85 via-orange-50/85 via-pink-50/85 to-sky-50/85 overflow-x-auto">
                <table className="w-full text-left text-[14px] border-collapse">
                  <thead className="bg-gradient-to-r from-sky-100/85 via-pink-100/85 via-orange-100/85 via-pink-100/85 to-sky-100/85 border-b border-pink-300/70 text-slate-800 font-bold">
                    <tr>
                      <th className="p-3.5">Название</th>
                      <th className="p-3.5">Каналы</th>
                      <th className="p-3.5">Формат</th>
                      <th className="p-3.5">Статус</th>
                      <th className="p-3.5">Расписание</th>
                      <th className="p-3.5 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pink-200/70 text-slate-800">
                    {filtered.map((post) => {
                      const sched = post.triggerSchedule;
                      const isScheduled = sched && sched.enabled;
                      const channelsStr =
                        post.channels && post.channels.length > 0
                          ? post.channels.join(', ')
                          : post.channel || '@IIrkiBot';

                      const statusLabel =
                        post.status === 'sent'
                          ? 'Опубликован'
                          : post.status === 'failed'
                          ? 'Ошибка'
                          : isScheduled
                          ? 'Запланирован'
                          : 'Черновик';

                      return (
                        <tr key={post.id} className="hover:bg-white/60 transition-colors">
                          <td className="p-3.5 max-w-xs">
                            <div className="font-bold text-slate-900 text-[14px] break-words">
                              {post.title || 'Без названия'}
                            </div>
                            <div className="text-[14px] text-slate-600 truncate mt-0.5">
                              {(post.postText || post.requestTemplate || '').slice(0, 75)}
                            </div>
                          </td>

                          <td className="p-3.5 font-semibold text-sky-700 text-[14px]">{channelsStr}</td>

                          <td className="p-3.5 font-semibold text-pink-700 text-[14px]">
                            {post.messageFormat === 'rich' ? 'Rich' : 'V2'}
                          </td>

                          <td className="p-3.5 font-semibold text-slate-800 text-[14px]">{statusLabel}</td>

                          <td className="p-3.5 text-[14px] text-slate-700">
                            {isScheduled ? (
                              sched.scheduledAt ? (
                                <span>{new Date(sched.scheduledAt).toLocaleString('ru-RU')}</span>
                              ) : (
                                <span>
                                  {sched.frequency || 'Ежедневно'} в {sched.time || '09:00'}
                                </span>
                              )
                            ) : (
                              <span>—</span>
                            )}
                          </td>

                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {onEditPost && (
                                <ResponsiveActionBtn
                                  icon={<Edit3 size={16} />}
                                  label="Изменить"
                                  showLabelFrom="lg"
                                  onClick={() => onEditPost(post.id)}
                                  variant="outline"
                                />
                              )}
                              <ResponsiveActionBtn
                                icon={<MessageSquare size={16} />}
                                label="Тест в личные"
                                showLabelFrom="lg"
                                onClick={() => onTestSendDM(post)}
                                variant="outline"
                              />
                              <ResponsiveActionBtn
                                icon={<Send size={16} />}
                                label="Отправить"
                                showLabelFrom="lg"
                                onClick={() => onPublishNow(post)}
                                variant="vivid"
                              />
                              <ResponsiveActionBtn
                                icon={<Trash2 size={16} />}
                                label="Удалить"
                                showLabelFrom="never"
                                onClick={() =>
                                  setPendingDelete({
                                    id: post.id,
                                    title: post.title || String(post.id)
                                  })
                                }
                                variant="danger"
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <GradientModalShell
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title="Удаление публикации"
        maxWidthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <ResponsiveActionBtn
              icon={<X size={16} />}
              label="Отмена"
              onClick={() => setPendingDelete(null)}
              variant="outline"
              alwaysShowLabel={true}
            />
            <ResponsiveActionBtn
              icon={<Trash2 size={16} />}
              label={isDeleting ? 'Удаление...' : 'Удалить'}
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              variant="danger"
              alwaysShowLabel={true}
            />
          </div>
        }
      >
        <p className="text-[14px] text-slate-800 font-medium leading-relaxed">
          Вы действительно хотите безвозвратно удалить публикацию «{pendingDelete?.title}» из базы данных?
        </p>
      </GradientModalShell>
    </div>
  );
};
