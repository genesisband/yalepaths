import { pinDomId, type Pin } from "@/lib/experiences";

export function PinButton({
  pin,
  selected,
  style,
  onSelect,
}: {
  pin: Pin;
  selected: boolean;
  style?: React.CSSProperties;
  onSelect: (key: string | null) => void;
}) {
  const place = pin.region ? `${pin.city}, ${pin.region}` : pin.city;
  return (
    <button
      type="button"
      className={selected ? "pin is-selected" : "pin"}
      style={style}
      data-testid={pinDomId(pin)}
      data-lng={pin.lng}
      data-lat={pin.lat}
      aria-pressed={selected}
      aria-label={`${place}, ${pin.count} ${pin.count === 1 ? "experience" : "experiences"}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={() => onSelect(selected ? null : pin.key)}
    >
      <span className="pin-count" aria-hidden="true">
        {pin.count}
      </span>
      <span className="pin-name" aria-hidden="true">
        {pin.city}
      </span>
    </button>
  );
}
