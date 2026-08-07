function DccsShadowCloth({ src, label }) {
  return (
    <img
      src={src}
      alt={label}
      className="Dcss-shadow-cloth"
      aria-label={label}
      width="330"
      height="330"
      loading="lazy"
    />
  );
}

export default DccsShadowCloth;
