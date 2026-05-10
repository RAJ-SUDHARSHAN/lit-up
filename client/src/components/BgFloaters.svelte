<script lang="ts">
  /**
   * Background suit cards. We mix small and large floaters with reds and
   * blacks so the page reads as "card game" the moment it loads, not as
   * an empty form. Positions are jittered but stable across renders.
   */
  const layout: Array<{ sym: string; l: string; t: string; size: "sm" | "md" | "lg"; red: boolean }> = [
    { sym: "♠", l: "4%",  t: "10%", size: "lg", red: false },
    { sym: "♥", l: "12%", t: "70%", size: "md", red: true  },
    { sym: "♦", l: "22%", t: "36%", size: "sm", red: true  },
    { sym: "♣", l: "30%", t: "85%", size: "md", red: false },
    { sym: "♠", l: "38%", t: "22%", size: "sm", red: false },
    { sym: "♥", l: "46%", t: "58%", size: "lg", red: true  },
    { sym: "♣", l: "56%", t: "12%", size: "md", red: false },
    { sym: "♦", l: "62%", t: "78%", size: "sm", red: true  },
    { sym: "♠", l: "70%", t: "44%", size: "md", red: false },
    { sym: "♥", l: "78%", t: "20%", size: "sm", red: true  },
    { sym: "♣", l: "84%", t: "66%", size: "md", red: false },
    { sym: "♦", l: "92%", t: "30%", size: "lg", red: true  },
  ];
  const floaters = layout.map((f, i) => ({
    ...f,
    rot: `${(Math.random() - 0.5) * 40}deg`,
    dur: `${8 + Math.random() * 6}s`,
    del: `${i * 0.35}s`,
  }));
</script>

<div class="bg-floaters" aria-hidden="true">
  {#each floaters as f, i (i)}
    <div
      class="bg-floater size-{f.size}"
      class:red={f.red}
      style="left:{f.l}; top:{f.t}; --rot:{f.rot}; --dur:{f.dur}; --del:{f.del};"
    >
      {f.sym}
    </div>
  {/each}
</div>
