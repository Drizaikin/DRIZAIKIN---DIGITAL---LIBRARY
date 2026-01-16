# Specification Plan - Priority Features

## Your Priority Order

### Phase 1: Quick Wins (Implement This Week)
1. **Remove Loan/Borrow Features** - Clean UI, no confusion
2. **Expand Genre Support** - Support all book genres

### Phase 2: Strategic Features (Requires Planning)
3. **Modern Books Ingestion** - Not just public domain
4. **AI Cover Generation** - Auto-generate book covers

---

## Phase 1: Quick Wins

### Feature 1: Remove Loan/Borrow Features
**Status:** ✅ Ready to implement (no spec needed - simple UI changes)

**What I'll do:**
- Remove borrow request button from BookDetailsModal
- Remove BORROWED/WAITLIST status from UI
- Simplify book status to just show availability
- Remove loan-related filters from browse view
- Keep database schema intact (for future use)

**Time:** 30 minutes
**Risk:** Very Low
**Can start:** Immediately after your approval

---

### Feature 2: Expand Genre Support
**Status:** ✅ Ready to implement (no spec needed - taxonomy update)

**What I'll do:**
- Expand `genreTaxonomy.js` to include all major genres
- Add missing genres: Romance, Thriller, Mystery, Horror, etc.
- Update AI classification prompts to handle all genres
- Test with diverse book samples

**Time:** 15 minutes
**Risk:** Very Low
**Can start:** Immediately after your approval

---

## Phase 2: Strategic Features (Need Specs)

### Feature 3: Modern Books Ingestion
**Status:** ⚠️ REQUIRES LEGAL REVIEW + Specification

**Critical Legal Questions:**
1. **Copyright:** How will you handle copyrighted content?
2. **Licensing:** Will you purchase licenses or partner with publishers?
3. **DRM:** Will books have digital rights management?
4. **Geography:** Which countries' copyright laws apply?
5. **Liability:** Who is responsible for copyright violations?

**Business Model Questions:**
1. Will this be a paid service?
2. Will you have publisher partnerships?
3. Will you use existing platforms (e.g., Google Books API)?
4. What's your budget for book licensing?

**Technical Considerations:**
- Remove date restriction (currently pre-1927)
- Add copyright verification system
- Implement licensing tracking
- Add DRM support (if needed)
- Payment integration (if needed)

**Recommendation:** 
⚠️ **PAUSE THIS FEATURE** until you have:
- Legal counsel review
- Business model decision
- Publisher partnerships (if applicable)
- Budget allocation

**I can create a spec, but implementation requires legal approval.**

---

### Feature 4: AI Cover Generation
**Status:** 📋 Ready for specification

**What this feature does:**
- Detects books with missing/placeholder covers
- Generates professional book covers using AI
- Validates cover text matches book metadata
- Applies to both manual uploads and ingested books
- Batch processing for existing books

**Key Questions I Need Answered:**

1. **Budget:** What's your monthly budget for cover generation?
   - DALL-E 3: ~$0.04 per image (high quality)
   - DALL-E 2: ~$0.02 per image (good quality)
   - Stable Diffusion: ~$0.002 per image (via Replicate)
   
2. **Quality vs Cost:** Which do you prefer?
   - High quality but expensive (DALL-E 3)
   - Good quality and affordable (DALL-E 2)
   - Lower quality but very cheap (Stable Diffusion)

3. **Validation:** How strict should cover validation be?
   - Must match title exactly?
   - Must include author name?
   - Allow artistic interpretation?

4. **Existing Books:** Should we regenerate covers for existing books?
   - How many books currently have placeholder covers?
   - Batch process all at once or gradually?

5. **Fallback:** What if AI generation fails?
   - Use placeholder cover?
   - Retry with different prompt?
   - Skip the book?

**Estimated Costs:**
- If you have 1000 books without covers
- Using DALL-E 2: $20 total
- Using DALL-E 3: $40 total
- Using Stable Diffusion: $2 total

**Time to Implement:** 2-3 weeks after spec approval

---

## Recommended Approach

### This Week: Quick Wins
**Day 1-2:**
1. ✅ Remove loan features (30 min)
2. ✅ Expand genre support (15 min)
3. ✅ Test and verify changes

**Result:** Cleaner UI, better genre coverage

### Next Week: AI Cover Generation Spec
**Day 3-5:**
1. 📋 You answer the budget/quality questions
2. 📋 I create detailed specification (Requirements → Design → Tasks)
3. 📋 You review and approve spec
4. 📋 I implement the feature

**Result:** Professional covers for all books

### Future: Modern Books (On Hold)
**When you're ready:**
1. ⚠️ Get legal review
2. ⚠️ Decide on business model
3. ⚠️ Then I create specification
4. ⚠️ Then implementation

**Result:** Expanded library with modern books (legally compliant)

---

## What Happens Next

### Option A: Start with Quick Wins NOW
I can implement Remove Loans + Expand Genres right now (45 minutes total).

**Say:** "Yes, do the quick wins now"

### Option B: Answer AI Cover Questions First
Answer the 5 questions about AI cover generation, then I'll create the spec.

**Say:** "Let me answer the AI cover questions first"

### Option C: Do Both
I implement quick wins while you think about AI cover questions.

**Say:** "Do quick wins now, I'll answer AI questions later"

---

## My Recommendation

**Do Option C:**
1. I implement quick wins NOW (45 min)
2. You think about AI cover budget/quality
3. Tomorrow we create AI cover spec
4. Next week we implement AI covers
5. Modern books stays on hold until legal review

This gives you immediate results while we plan the bigger features properly.

**What would you like me to do?**
