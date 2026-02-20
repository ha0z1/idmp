export default function Ribbon() {
  return (
    <div className="fixed top-0 right-0 z-50">
      <a
        href="https://github.com/ha0z1/idmp"
        target="_blank"
        className="block bg-black px-12 py-1 text-xs font-medium text-white transition-colors hover:bg-neutral-800"
        style={{
          transform: 'translate(29.29%, 100%) rotate(45deg)',
          transformOrigin: 'top left',
        }}
      >
        Fork me on GitHub
      </a>
    </div>
  )
}
