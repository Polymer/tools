var jsdoc = require('hydrolysis').jsdoc;

describe('jsdoc', function() {

  describe('.parseJsdoc', function() {

    it('parses single-line', function() {
      var parsed = jsdoc.parseJsdoc('* Just some text');
      expect(parsed).to.deep.eq({
        description: 'Just some text',
        tags: [],
      });
    });

    it('parses body-only', function() {
      var parsed = jsdoc.parseJsdoc('* Just some text\n* in multiple lines.');
      expect(parsed).to.deep.eq({
        description: 'Just some text\nin multiple lines.',
        tags: [],
      });
    });

    it('parses tag-only', function() {
      var parsed = jsdoc.parseJsdoc('* @atag');
      expect(parsed).to.deep.eq({
        description: '',
        tags: [
          {tag: 'atag', description: null, name: undefined, type: null},
        ],
      });
    });

    it('parses tag-name', function() {
      var parsed = jsdoc.parseJsdoc('* @do stuff');
      expect(parsed).to.deep.eq({
        description: '',
        tags: [
          {tag: 'do', description: 'stuff', name: undefined, type: null},
        ],
      });
    });

    it('parses tag-desc', function() {
      var parsed = jsdoc.parseJsdoc('* @do a thing');
      expect(parsed).to.deep.eq({
        description: '',
        tags: [
          {tag: 'do', description: 'a thing', name: undefined, type: null},
        ],
      });
    });

    it('parses param type', function() {
      var parsed = jsdoc.parseJsdoc('* @param {Type} name desc desc');
      expect(parsed).to.deep.eq({
        description: '',
        tags: [
          {tag: 'param', type: "Type", name: 'name', description: 'desc desc'},
        ],
      });
    });

    it('preserves indentation for the body', function() {
      var parsed = jsdoc.parseJsdoc('*     The desc.\n*     thing');
      expect(parsed.description).to.deep.eq('    The desc.\n    thing');
    });

    it('handles empty lines', function() {
      var parsed = jsdoc.parseJsdoc('*\n *\n * Foo\n   *\n * Bar');
      expect(parsed.description).to.eq('\n\nFoo\n\nBar');
    });

  });

});
