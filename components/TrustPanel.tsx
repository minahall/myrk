export default function TrustPanel() {
  return (
    <section className="s" id="trust">
      <h2>What even we can see</h2>
      <p className="lede">
        The people who run Myrk are part of the threat model. Here is the honest split.
      </p>
      <div className="lists">
        <div className="hid">
          <h3>Hidden by mathematics</h3>
          <ul>
            <li>What your tip says</li>
            <li>What the journalist replies</li>
            <li>The full path, while each relay has a different operator</li>
          </ul>
        </div>
        <div className="vis">
          <h3>Visible to an operator</h3>
          <ul>
            <li>Your address at the entry relay</li>
            <li>When each tip arrived</li>
            <li>The size of a message, unless it is padded</li>
          </ul>
        </div>
      </div>
      <p className="note">
        We say this out loud because a privacy tool that hides its limits cannot be trusted.
      </p>
    </section>
  );
}
