<script>
    
    import Timer from "./Timer.svelte";
    import HowTo from "./HowTo.svelte";

    let audioTick;
    let audioSuccess;

    const timerTickHandler = () => {
        audioTick.play();
    }
    const timerEndHandler = () => {
        audioSuccess.play();
    }

</script>


<style>

    main {
        display: flex;
        align-items: center;
        flex-direction: column;
        max-width: 60rem;
        margin: 0 auto;
        padding: 0 1rem 2rem;
    }

    h1 {
        text-align: center;
        font-size: 3rem;
        font-weight: 900;
        background: var(--clr-gradient);
        background-clip: text;
        -webkit-background-clip: text;
        color: transparent;
    }

</style>


<main>
    
    <h1>Handwashing App</h1>

    <Timer
        on:timerTick={timerTickHandler}
        on:timerEnd={timerEndHandler}
    />
    
    <audio bind:this={audioTick} >
        <source src="single-tick.wav" type="audio/wav">
    </audio>
    <audio bind:this={audioSuccess} >
        <source src="success-bell.wav" type="audio/wav">
    </audio>
    
    <HowTo />

</main>
