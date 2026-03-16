export default function BookmarksPage() {
  return (
    <div className="min-h-full flex items-center justify-center p-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-9 h-9 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">ブックマーク</h1>
        <p className="text-gray-400 text-xs mt-2">ブックマーク機能は近日実装予定です</p>
      </div>
    </div>
  )
}
