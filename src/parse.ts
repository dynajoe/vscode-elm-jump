import * as _ from 'lodash'
const P = require('parsimmon')

function symbol(s: string) {
   return surroundedBy(whitespace, typeof s === 'string' ? P.string(s) : s)
}

function initialSymbol(s: string) {
   return P.string(s).skip(spaces_)
}

const spaces = P.regexp(/[ \t]*/)
const spaces_ = P.regexp(/[ \t]+/)
const whitespace2 = P.regexp(/\s*/m)
const whitespace = P.regexp(/[ \t\x0D\n]*/)

const lbrace = P.string('{')
const rbrace = P.string('}')
const lparen = P.string('(')
const rparen = P.string(')')
const comma = P.string(',')
const colon = P.string(':')
const equal = P.string('=')
const pipe = P.string('|')
const arrow = P.string('->')

const loName = P.alt(P.string('_'), P.regexp(/[a-z][a-zA-Z0-9_]*/))

const upName = P.regexp(/[A-Z][a-zA-Z0-9_]*/)

const moduleName = P.sepBy1(upName, P.string('.')).map(x => x.join('.'))

function surroundedBy(bookend, parser) {
   return bookend.then(parser).skip(bookend)
}

function between(left, right, parser) {
   return left.then(parser).skip(right)
}

function braces(parser) {
   return between(lbrace, rbrace, parser)
}

function parens(parser) {
   return between(lparen, rparen, parser)
}

function commaSep(parser) {
   return P.sepBy1(surroundedBy(whitespace, parser), comma)
}

const exportList = parens(
   P.alt(
      P.sepBy1(
         P.alt(loName, upName), comma
      ),
      symbol('..'),
   )
)

const exposingClause = symbol('exposing').then(exportList).fallback([])

const moduleStatement = P.regexp(/(port )?module/)
   .then(P.seq(
      moduleName,
      exposingClause
   ))
   .map(([ module_name, exposing ]) => {
      return {
         kind: 'module',
         name: module_name,
         exposing: exposing,
      }
   })

const importStatement = initialSymbol('import').then(
   P.seq(
      moduleName,
      symbol('as').then(upName).fallback(null),
      symbol('exposing').then(exportList).fallback([]),
   )
)
.map(([ name, alias, exposed ]) => {
   return {
      kind: 'import',
      module: name,
      alias: alias,
      exposing: exposed,
   }
})

const typeVariable = P.regexp(/[a-z]+(\\w|_)*/).desc('typeVariable')

const typeConstant = moduleName

const typeParameter = P.lazy(() => {
   return surroundedBy(spaces, P.alt(
      typeVariable,
      typeConstant,
      typeRecordConstructor,
      typeRecord,
      typeTuple,
      parens(typeAnnotation)
   ))
})

const typeAnnotation = P.lazy(() =>
   P.sepBy1(type_, arrow)
)

const typeRecord = P.lazy(() =>
   braces(typeRecordPairs)
)
.desc('typeRecord')

const typeTuple = P.lazy(() =>
   parens(commaSep(type_))
)
.desc('typeTuple')

const typeRecordPair = P.seq(
   surroundedBy(whitespace, loName).skip(colon),
   typeAnnotation
)

const typeRecordPairs = commaSep(
   typeRecordPair
)

const typeRecordConstructor = P.lazy(() => {
   return braces(P.seq(
      surroundedBy(spaces, typeVariable).skip(pipe),
      typeRecordPairs
   ))
}).desc('typeRecordConstructor')

const typeConstructor = P.lazy(() => {
   return P.seq(
      moduleName,
      typeParameter.many()
   )
})
.desc('typeConstructor')
.map(([ name, typeParameters ]) => {
   return {
      kind: 'type_constructor',
      name: name,
      parameters: typeParameters,
   }
})

const type_ = P.lazy(() => {
   return surroundedBy(spaces, P.alt(
      typeConstructor,
      typeVariable,
      typeRecordConstructor,
      typeRecord,
      typeTuple,
      parens(typeAnnotation)
   ))
})

const typeAliasDeclaration = initialSymbol('type alias').then(
   P.seq(
      type_.skip(symbol(equal)).map(([ name, extra ]) => ({ name: name.join(''), extra: extra })),
      typeAnnotation
   )
)
.map(([ declaration, annotation ]) => {
   return {
      kind: 'type_alias',
      name: declaration.name,
      annotation,
   }
})

const typeDeclaration = initialSymbol('type').then(
   P.seq(
      type_.skip(symbol(equal)),
      P.sepBy1(surroundedBy(whitespace, typeConstructor), symbol(pipe))
   )
)
.map(([ declaration, constructors ]) => {
   return {
      kind: 'type',
      name: declaration.name,
      constructors,
   }
})

const elmStatement = P.lazy(function () {
   return surroundedBy(whitespace,
      P.seq(
         P.index,
         P.alt(
            moduleStatement,
            importStatement,
            typeDeclaration,
            typeAliasDeclaration,
            P.regexp(/.*\n/).result(null)
         )
      )
      .map(([ position, value ]) => {
         if (value) {
            return { ...value, position }
         }
      })
      .many()
   )
   .map(x => _.compact(x))
})

type_.skip(symbol(equal)).parse("type Foo = A")

export function parse(text: string): ElmParseResult {
   return elmStatement.parse(text)
}

export interface Statement {
   kind: string
   position: { line: number, column: number, offset: number },
}

export interface ImportStatement extends Statement {
   module: string
   alias: string
   exposing: string | string[]
}

export interface NamedStatement extends Statement {
   name: string
}

export interface ElmParseResult {
   status: boolean
   value: Statement[]
}
