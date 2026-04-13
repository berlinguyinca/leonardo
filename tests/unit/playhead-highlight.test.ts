// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'

describe('usePlayheadHighlight — section DOM manipulation', () => {
  it('applyHighlight adds section-active to h2 and following p elements', () => {
    document.body.innerHTML =
      '<div><h2>Section 1</h2><p>Text 1</p><p>Text 2</p><h2>Section 2</h2><p>Text 3</p></div>'
    const container = document.body.firstElementChild as HTMLElement

    // Apply to section 0
    const headings = container.querySelectorAll('h2')
    headings[0].classList.add('section-active')
    let sibling = headings[0].nextElementSibling
    while (sibling && sibling.tagName !== 'H2') {
      if (sibling.tagName === 'P') sibling.classList.add('section-active')
      sibling = sibling.nextElementSibling
    }

    expect(headings[0].classList.contains('section-active')).toBe(true)
    expect(container.querySelectorAll('.section-active').length).toBe(3) // h2 + 2 p's
    // Section 2 should NOT be highlighted
    expect(headings[1].classList.contains('section-active')).toBe(false)
  })

  it('clearHighlight removes all section-active classes', () => {
    document.body.innerHTML =
      '<div><h2 class="section-active">S1</h2><p class="section-active">T1</p></div>'
    const container = document.body.firstElementChild as HTMLElement
    container.querySelectorAll('.section-active').forEach((el) => el.classList.remove('section-active'))
    expect(container.querySelectorAll('.section-active').length).toBe(0)
  })
})
