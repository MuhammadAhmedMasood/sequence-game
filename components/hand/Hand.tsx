import type { CardInstance } from "@/lib/game/types";
import Card from "./Card";

interface HandProps {
  cards: CardInstance[];
  selectedInstanceId: string | null;
  onSelect: (instanceId: string) => void;
}

export default function Hand({ cards, selectedInstanceId, onSelect }: HandProps) {
  return (
    <div className="flex justify-center gap-1.5 overflow-x-auto px-1 py-2 sm:gap-2.5">
      {cards.map((card) => (
        <Card
          key={card.instanceId}
          card={card}
          selected={card.instanceId === selectedInstanceId}
          onClick={() => onSelect(card.instanceId)}
        />
      ))}
    </div>
  );
}
