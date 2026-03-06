export default function Table({ columns, rows, emptyLabel }) {
  return (
    <div className="mt-5 overflow-hidden rounded-[22px] border border-white/10">
      <table className="min-w-full text-left">
        <thead className="bg-white/5 text-xs uppercase tracking-[0.18em] text-slate-400">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-medium">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/6 text-sm text-slate-200">
          {rows.length ? (
            rows
          ) : (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
