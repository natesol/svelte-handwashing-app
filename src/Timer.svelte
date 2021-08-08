<script>

    import ProgressBar from "./ProgressBar.svelte";

    const TOTAL_SECONDS = 20;

    let secondsLeft = TOTAL_SECONDS;
    let isTimerRunning = false;
    $: progress = 0;

    const startTimer = () => {
        isTimerRunning = true;

        const timer = setInterval( () => {
            secondsLeft--;
            progress = (TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS * 100;
            if (secondsLeft === 0) {
                clearInterval(timer);
                setTimeout( () => {
                    secondsLeft = TOTAL_SECONDS;
                    progress = 0;
                    isTimerRunning = false;
                }, 1000);
            }
        } , 1000);

    }
    
</script>

<style>

    .timer {
        margin: 1rem 0 2rem 0;
        width: 100%;
        max-width: 20rem;
    }

    h2 {
        margin: 0;
    }

    button {
        background: var(--clr-primary);
        background: linear-gradient(90deg, var(--clr-accent) 0%, var(--clr-primary) 100%);
        color: var(--clr-txt-onDark);
        font-size: 1.2rem;
        width: 100%;
    }

</style>


<div class="timer">

    <h2>time left: {secondsLeft > 1 ? `${secondsLeft} seconds` : ( secondsLeft === 1 ? `${secondsLeft} second` : `Time's Up.`) }</h2>

    <ProgressBar progress={progress} />

    <button on:click={startTimer} disabled={isTimerRunning}>start</button>

</div>
