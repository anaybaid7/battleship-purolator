// delete a room and tell both players. used by the idle timeout and disconnect

function createRoomCloser(io, rooms) {
  return function deleteRoom(roomId, reason) {
    const room = rooms.delete(roomId);
    if (!room) return;
    room.players.forEach((p) => io.to(p.id).emit("room_closed", { reason }));
    console.log(`Room ${roomId} deleted (${reason}). Active rooms: ${rooms.activeRoomCount}`);
  };
}

module.exports = { createRoomCloser };
