import RoomClient from "./RoomClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomCode: string }>;
}) {
  const { roomCode } = await params;
  return <RoomClient roomCode={roomCode} />;
}
