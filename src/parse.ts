import * as _ from 'lodash'

const P = require('parsimmon')

function token(p) {
  return p.skip(whitespace)
}

const whitespace = P.regexp(/\s*/m)
const lbrace = token(P.string('{'))
const rbrace = token(P.string('}'))
const lparen = token(P.string('('))
const rparen = token(P.string(')'))
const comma = token(P.string(','))
const colon = token(P.string(':'))
const equal = token(P.string('='))
const pipe = token(P.string('|'))
const arrow = token(P.string('->'))

const loName = P.regexp(/[a-z][a-zA-Z0-9_]*/)
const upName = P.regexp(/[A-Z][a-zA-Z0-9_]*/)
const moduleName = P.sepBy(upName, P.string('.')).map(x => x.join('.'))

function braces(parser) {
  return lbrace.then(parser.skip(whitespace)).skip(rbrace)
}

function parens(parser) {
  return lparen.then(parser.skip(whitespace)).skip(rparen)
}

function commaSep(parser) {
  return P.sepBy(parser.skip(whitespace), token(comma))
}

const exportList = lparen.then(
   P.alt(
      P.sepBy1(
         P.alt(loName, upName), token(comma)
      ),
      token(P.string('..')).result('*'),
   )
).skip(rparen)

const exposingClause = token(P.string('exposing')).then(exportList).fallback([])

const moduleStatement = token(P.regexp(/(port )?module/))
  .then(P.seq(
     moduleName,
     exposingClause
  ))
  .map(([module_name, exposing]) => {
    return {
      kind: 'module',
      name: module_name,
      exposing: exposing,
    }
  })

const importStatement = token(P.string('import'))
   .then(P.seq(
      token(moduleName),
      token(P.string('as')).then(token(upName)).fallback(null),
      token(P.string('exposing')).then(exportList).fallback([]),
   ))
   .map(([name, alias, exposed]) => {
      return {
         kind: 'import',
         module: name,
         alias: alias,
         exposing: exposed,
      }
   })

const typeVariable = P.regexp(/[a-z]+(\\w|_)*/).desc('typeVariable')

const typeConstant = token(P.sepBy1(upName, P.string('.')))

const typeParameter = P.lazy(() => {
  return P.alt(
    typeVariable,
    typeConstant,
    typeRecordConstructor,
    typeRecord,
    typeTuple,
    parens(typeAnnotation)
  )
})

const typeAnnotation = P.lazy(() => P.sepBy1(type_, arrow))

const typeRecord = P.lazy(() => braces(typeRecordPairs)).desc('typeRecord')

const typeTuple = P.lazy(() => parens(commaSep(type_))).desc('typeTuple')

const typeRecordPair = P.seq(
    token(loName).skip(colon),
    typeAnnotation
)

const typeRecordPairs = commaSep(
  typeRecordPair
)

const typeRecordConstructor = P.lazy(() => {
  return braces(P.seq(
    token(typeVariable).skip(pipe),
    typeRecordPairs
  ))
}).desc('typeRecordConstructor')

const typeConstructor = P.lazy(() => {
  return P.seq(
    P.sepBy1(upName, P.string('.')),
    typeParameter.many()
  )
}).desc('typeConstructor')

const type_ = P.lazy(() => {
  return whitespace.then(P.alt(
    typeConstructor,
    typeVariable,
    typeRecordConstructor,
    typeRecord,
    typeTuple,
    parens(typeAnnotation)
  ))
})

const typeAliasDeclaration = token(P.string('type alias')).then(
  P.seq(
    type_.skip(whitespace).skip(equal).map(([ name, extra ]) => ({ name: name.join(''), extra: extra})),
    typeAnnotation
  )
).map(([ declaration, annotation ]) => {
  return {
    kind: 'type_alias',
    name: declaration.name,
  }
})

const typeDeclaration = token(P.string('type')).then(
  P.seq(
    type_.skip(whitespace).skip(equal).map(([ name, extra ]) => ({ name: name.join(''), extra: extra})),
    P.sepBy1(whitespace.then(typeConstructor), pipe)
  )
).map(([ declaration ]) => {
  return {
    kind: 'type',
    name: declaration.name,
  }
})

const elmStatement = P.lazy(function () {
    return whitespace.then(
        P.seq(
          P.index,
          P.alt(
            moduleStatement,
            importStatement,
            typeDeclaration,
            typeAliasDeclaration,
            P.regexp(/.*\n/).result(null)
         )
       ).map(([position, value]) => {
          if (value) {
            return { ...value, position }
          }
       }).many()
    )
    .map(x => _.compact(x))
})

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

export function parse(text: string): ElmParseResult {
   return elmStatement.parse(text)
}