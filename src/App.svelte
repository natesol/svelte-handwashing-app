<script>
    
    import Timer from "./Timer.svelte";
    import HowTo from "./HowTo.svelte";

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
    <Timer />
    <HowTo />
</main>
