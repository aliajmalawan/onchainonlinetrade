export default function ComingSoon({ title, description }) {
  return (
    <div>
      <div className="page-head">
        <div className="eyebrow">Account</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="panel empty">
        This feature isn't available in this demo — there's no real deposit,
        withdrawal, or identity-verification system behind this app.
      </div>
    </div>
  )
}
