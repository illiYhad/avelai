// K-AV-RULES.1: ลำดับจัดทีมแบบงู (Snake Draft) · ฟังก์ชันล้วน
// เรียงผู้เล่นตาม Form Index อันดับ 1..n แล้วสลับฝั่ง A B B A A B B A … (ต้นแบบ :264–283)
// n = 10 → ทีม 1 = 1,4,5,8,9 · ทีม 2 = 2,3,6,7,10
export function snakeOrder(n: number): [number[], number[]] {
  const team1: number[] = [];
  const team2: number[] = [];
  for (let rank = 1; rank <= n; rank++) {
    (rank % 4 === 0 || rank % 4 === 1 ? team1 : team2).push(rank);
  }
  return [team1, team2];
}
