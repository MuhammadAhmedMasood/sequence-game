import type { CardInstance } from "@/lib/game/types";
import Card from "./Card";

interface HandProps {
  cards: CardInstance[];
  selectedInstanceId: string | null;
  onSelect: (instanceId: string) => void;
}

export default function Hand({ cards, selectedInstanceId, onSelect }: HandProps) {
  return (
    <div className="flex gap-2 overflow-x-auto p-2">
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
