Created by 张周玺, last modified by  方少奎 on 八月 21, 2024

### todo：expression归类：逻辑表达式，算术表达式，多目运算

### 3、  DbExpression类型列表和visit方法的主要实现细节

|DbExpression的子类型|大概含义|visit方法返回的SqlFragment类型|场景和用法|
|:---|:---|:---|---|
|DbVariableReferenceExpression|变量的引用|PropertyFragment    
  别名|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ,   'C1'  =  Edm  .  Int32  ]}    
      |  _Project    
        |  _Input :   'Filter1'    
        |     |  _Filter    
        |       |  _Input :   'Extent1'    
        |       |     |  _Scan :   CodeFirstDatabase  .  Book    
        |       |  _Predicate    
        |         |  _    
        |           |  _    
        |           |     |  _Var(  Extent1  ).  Id    
        |           |     |  _  >    
        |           |     |  _1    
        |           |  _And    
        |           |  _Like    
        |             |  _Var(  Extent1  ).  Name    
        |             |  _  '%aa%'    
        |             |_null(用途)    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ,   'C1'  =  Edm  .  Int32  ]    
            |  _Column :   'Id'    
            |     |  _Var(  Filter1  ).  Id    
            |  _Column :   'C1'    
              |  _    
                |  _    
                |     |  _Var(  Filter1  ).  Pages    
                |     |  _  +    
                |     |  _2    
                |  _  *    
                |  _10,SELECT "Extent1"."Id", ("Extent1"."Pages" + 2) * 10 AS "C1"     
  FROM "SIMPLEQUERY"."Books" AS "Extent1"     
  WHERE ("Extent1"."Id" > 1) AND ("Extent1"."Name" LIKE ?)|
|DbPropertyExpression|列的一些属性|ColumnFragment ,DbPropertyExpression.Instance为DbVariableReferenceExpression，代表列所属的表名的引用。,从DbPropertyExpression  .  Property  .  Name作为列名。,表名的引用获取表名和表别名（如果有别名的话）,如果是查询语句的话，如果有别名，再获取列的别名。||
|DbScanExpression|要查询的表|TableFragment    
  表名和schema||
|DbConstantExpression|sql语句里面的常量value值|LiteralFragment,数字和布尔类型转化成数字字面量,其他类型直接当成参数进行绑定，一般就是字面量问号||
|DbComparisonExpression|比较|如果是like操作，返回LikeFragment，,其他操作，返回 BinaryFragment||
|DbAndExpression|and|BinaryFragment||
|DbLikeExpression,todo: 使用escape|like|LikeFragment||
|DbArithmeticExpression|算术表达式|如果为负，返回 ListFragment，拼上-号和括号,其他的都会转成BinaryFragment ||
|DbParameterReferenceExpression|参数表达式|LiteralFragment 转化成,"@"   +   expression  .  ParameterName 的字面量    
    
  todo:改成：|DbQueryCommandTree    
  |  _Parameters    
  |     |  _pages :   Edm  .  Int32    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ]}    
      |  _Project    
        |  _Input :   'Filter1'    
        |     |  _Filter    
        |       |  _Input :   'Extent1'    
        |       |     |  _Scan :   CodeFirstDatabase  .  Book    
        |       |  _Predicate    
        |         |  _    
        |           |  _Var(  Extent1  ).  Pages    
        |           |  _  >    
        |           |  _  @pages    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ]    
            |  _Column :   'Id'    
            |     |  _Var(  Filter1  ).  Id    
  SELECT "Extent1"."Id" FROM "Books" AS "Extent1" WHERE "Extent1"."Pages" > @pages|
|DbIsEmptyExpression|是否存在|ExistsFragment|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ]}    
      |  _Project    
        |  _Input :   'Filter2'    
        |     |  _Filter    
        |       |  _Input :   'Extent1'    
        |       |     |  _Scan :   CodeFirstDatabase  .  Author    
        |       |  _Predicate    
        |         |  _Not    
        |           |  _IsEmpty    
        |             |  _Project    
        |               |  _Input :   'Filter1'    
        |               |     |  _Filter    
        |               |       |  _Input :   'Extent2'    
        |               |       |     |  _Scan :   CodeFirstDatabase  .  Book    
        |               |       |  _Predicate    
        |               |         |  _    
        |               |           |  _    
        |               |           |     |  _Var(  Extent2  ).  Name    
        |               |           |     |  _  =    
        |               |           |     |  _Var(  Extent1  ).  Name    
        |               |           |  _Or    
        |               |           |  _    
        |               |             |  _IsNull    
        |               |             |     |  _Var(  Extent2  ).  Name    
        |               |             |  _And    
        |               |             |  _IsNull    
        |               |               |  _Var(  Extent1  ).  Name    
        |               |  _Projection    
        |                 |  _NewInstance :   Record  [  'C1'  =  Edm  .  Int32  ]    
        |                   |  _Column :   'C1'    
        |                     |  _1    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ]    
            |  _Column :   'Id'    
            |     |  _Var(  Filter2  ).  Id,  
,SELECT   "Extent1"."Id",    ,FROM "SIMPLEQUERY"."Authors" AS "Extent1" ,WHERE EXISTS(,  SELECT 1 AS "C1" ,  FROM "SIMPLEQUERY"."Books" AS "Extent2" ,  WHERE ("Extent2"."Name" = "Extent1"."Name") ,  OR (,    ("Extent2"."Name" IS  NULL) ,    AND ,    ("Extent1"."Name" IS  NULL),  ),)|
|DbFunctionExpression|函数|内置函数转化成 LiteralFragment：内容为拼好function这一块的字面量。    
    
  用户自定义函数会按照函数名参数等拼成,FunctionFragment,  
|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'C1'  =  Edm  .  Decimal  ]}    
      |  _Project    
        |  _Input :   'Extent1'    
        |     |  _Scan :   CodeFirstDatabase  .  Book    
        |  _Projection    
          |  _NewInstance :   Record  [  'C1'  =  Edm  .  Decimal  ]    
            |  _Column :   'C1'    
              |  _Cast :   Edm  .  Decimal    
                |  _Yashandb.  Floor  (  Edm  .  Int32   arg)    
                  |  _Arguments    
                    |  _arg    
                      |  _Var(  Extent1  ).  Id,  
,SELECT FLOOR("Extent1"."Id") AS "C1" FROM "SIMPLEQUERY"."Books" AS "Extent1"|
|DbOrExpression,todo：服务器in是否优化成or|or|BinaryFragment|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ]}    
      |  _Project    
        |  _Input :   'Filter1'    
        |     |  _Filter    
        |       |  _Input :   'Extent1'    
        |       |     |  _Scan :   CodeFirstDatabase  .  Book    
        |       |  _Predicate    
        |         |  _    
        |           |  _    
        |           |     |  _    
        |           |     |     |  _    
        |           |     |     |     |  _1    
        |           |     |     |     |  _  =    
        |           |     |     |     |  _Cast(  Var  (  Extent1  ).  Id     As     Edm  .  Int64  )    
        |           |     |     |  _Or    
        |           |     |     |  _    
        |           |     |       |  _2    
        |           |     |       |  _  =    
        |           |     |       |  _Cast(  Var  (  Extent1  ).  Id     As     Edm  .  Int64  )    
        |           |     |  _Or    
        |           |     |  _    
        |           |       |  _3    
        |           |       |  _  =    
        |           |       |  _Cast(  Var  (  Extent1  ).  Id     As     Edm  .  Int64  )    
        |           |  _And    
        |           |  _Not    
        |             |  _IsNull    
        |               |  _Cast(  Var  (  Extent1  ).  Id     As     Edm  .  Int64  )    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ]    
            |  _Column :   'Id'    
              |  _Var(  Filter1  ).  Id,SELECT "Extent1"."Id"     
  FROM "SIMPLEQUERY"."Books" AS "Extent1"     
  WHERE     
  (    
    (    
      (1 = ("Extent1"."Id"))     
      OR     
      (2 = ("Extent1"."Id"))    
    )     
    OR (3 = ("Extent1"."Id"))    
  )     
  AND ("Extent1"."Id" IS NOT NULL)|
|DbCastExpression,todo：完善？|cast|  
||
|DbNotExpression|not表达式|NegatableFragment||
|DbIsNullExpression|is null|IsNullFragment||
|DbInExpression|in|InFragment|providerManifest定义中不支持IN表达式|
|DbCaseExpression|case when|CaseFragment|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ,   'C1'  =  Edm  .  String  ]}    
      |  _Project    
        |  _Input :   'Extent1'    
        |     |  _Scan :   CodeFirstDatabase  .  Book    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ,   'C1'  =  Edm  .  String  ]    
            |  _Column :   'Id'    
            |     |  _Var(  Extent1  ).  Id    
            |  _Column :   'C1'    
              |  _Case    
                |  _When    
                |     |  _    
                |       |  _Var(  Extent1  ).  Id    
                |       |  _  <    
                |       |  _20    
                |  _Then    
                |     |  _  'Cheap'    
                |  _When    
                |     |  _    
                |       |  _Var(  Extent1  ).  Id    
                |       |  _  <=    
                |       |  _100    
                |  _Then    
                |     |  _  'Moderate'    
                |  _Else    
                  |  _  'Expensive',SELECT "Extent1"."Id", CASE WHEN ("Extent1"."Id" < 20) THEN (?)  WHEN ("Extent1"."Id" <= 100) THEN (?)  ELSE (?) END AS "C1" FROM "SIMPLEQUERY"."Books" AS "Extent1"|
|DbNullExpression|null|LiteralFragment  (  "NULL"  )|DbUpdateCommandTree    
  |  _Parameters    
  |  _Target :   'target'    
  |     |  _Scan :   CodeFirstDatabase  .  Product    
  |  _SetClauses    
  |     |  _DbSetClause    
  |       |  _Property    
  |       |     |  _Var(target).  Name    
  |       |  _Value    
  |         |  _null    
  |  _Predicate    
  |     |  _    
  |       |  _Var(target).  Id    
  |       |  _  =    
  |       |  _1    
  |  _Returning,UPDATE "UPDATETESTS"."m_product" SET "Name"=NULL WHERE "Id" = 1|
|DbLambdaExpression|  
|没实现|  
|
|DbIntersectExpression|交集操作|mysql不支持，oracle支持（INTERSECT）|  
|
|DbTreatExpression|多态表达式|不支持|  
|
|DbRelationshipNavigationExpression|关系导航|不支持|  
|
|DbRefExpression|Ref|不支持|  
|
|DbOfTypeExpression|OfType|不支持|  
|
|DbIsOfExpression|IsOf|不支持|  
|
|DbRefKeyExpression|RefKey|不支持|  
|
|DbEntityRefExpression|EntityRef|不支持|  
|
|DbExceptExpression|Except|mysql不支持，oracle支持（minus）|  
|
|DbDerefExpression|表示基于指定引用检索实体的表达式。|没实现|  
|
|DbQuantifierExpression|  
|mysql不支持，oracle支持（EXISTS 或NOT EXISTS）|  
|
|DbProjectExpression|子查询|只支持select语句，返回,SelectStatement    
    
,查询树根节点。,1、VisitInputExpression,根据project下input的Expression类型调用visit。,如果是select片段，当前片段就是完整片段；,其他，则是属于select片段的From片段。,2、是否子查询，是则newSelect.From = oldSelect,3、VisitNewInstanceExpression|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ]}    
      |  _Project    
        |  _Input :   'Filter1'    
        |     |  _Filter    
        |       |  _Input :   'Extent1'    
        |       |     |  _Scan :   CodeFirstDatabase  .  Book    
        |       |  _Predicate    
        |         |  _    
        |           |  _1    
        |           |  _  =    
        |           |  _Var(  Extent1  ).  Id    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ]    
            |  _Column :   'Id'    
            |     |  _Var(  Filter1  ).  Id,  
,  
,  
,SELECT "Extent1"."Id" FROM "SIMPLEQUERY"."Books" AS "Extent1" WHERE 1 = "Extent1"."Id"|
|DbNewInstanceExpression|给定类型的新实例|只支持select语句，返回,SelectStatement，一般是 select ... from dual,query树column节点。,遍历子节点，根据不同类型expression调用对应的visit||
|DbFilterExpression|  
|只支持select语句，返回,SelectStatement    
    
,where节点。,先拼接input节点（from表达式），再拼接predicate节点（where表达式）||
|DbLimitExpression|  
|只支持select语句，返回,SelectStatement，后面拼上 limit 语法    
    
  先处理input节点，再拼接limit|ctx  .  Books  .  OrderBy  (  b => b  .  Pages  ).  Skip  (  3  ).  Take  (  1  )    
    
,DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ,   'Name'  =  Edm  .  String  ,   'PubDate'  =  Edm  .  DateTime  ,   'Pages'  =  Edm  .  Int32  ,   'Author_Id'  =  Edm  .  Int32  ]}    
      |  _Project    
        |  _Input :   'Limit1'    
        |     |  _Limit    
        |       |  _Skip    
        |       |     |  _Input :   'Extent1'    
        |       |     |     |  _Scan :   CodeFirstDatabase  .  Book    
        |       |     |  _SortOrder    
        |       |     |     |  _Asc    
        |       |     |       |  _Var(  Extent1  ).  Pages    
        |       |     |  _Count    
        |       |       |  _3    
        |       |  _1    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ,   'Name'  =  Edm  .  String  ,   'PubDate'  =  Edm  .  DateTime  ,   'Pages'  =  Edm  .  Int32  ,   'Author_Id'  =  Edm  .  Int32  ]    
            |  _Column :   'Id'    
            |     |  _Var(  Limit1  ).  Id    
            |  _Column :   'Name'    
            |     |  _Var(  Limit1  ).  Name    
            |  _Column :   'PubDate'    
            |     |  _Var(  Limit1  ).  PubDate    
            |  _Column :   'Pages'    
            |     |  _Var(  Limit1  ).  Pages    
            |  _Column :   'Author_Id'    
              |  _Var(  Limit1  ).  Author_Id,  
,SELECT "Extent1"."Id", "Extent1"."Name", "Extent1"."PubDate", "Extent1"."Pages", "Extent1"."Author_Id"    
  FROM "SIMPLEQUERY"."Books" AS "Extent1"    
  ORDER BY "Extent1"."Pages" ASC LIMIT 3,1,  
|
|DbSkipExpression|  
|只支持select语句，返回,SelectStatement，后面拼上 limit 语法||
|DbSortExpression|  
|只支持select语句，返回,SelectStatement，对每一个排序字段生成一个SortFragment||
|DbJoinExpression|  
|只支持select语句，返回,JoinFragment，拼join子句    
    
  先拼接左input节点，再拼接右input节点，再执行join condition节点|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ,   'Name'  =  Edm  .  String  ,   'Name1'  =  Edm  .  String  ]}    
      |  _Project    
        |  _Input :   'Join1'    
        |     |  _InnerJoin    
        |       |  _Left :   'Extent1'    
        |       |     |  _Scan :   CodeFirstDatabase  .  Book    
        |       |  _Right :   'Extent2'    
        |       |     |  _Scan :   CodeFirstDatabase  .  Author    
        |       |  _JoinCondition    
        |         |  _    
        |           |  _Var(  Extent1  ).  Author_Id    
        |           |  _  =    
        |           |  _Var(  Extent2  ).  Id    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ,   'Name'  =  Edm  .  String  ,   'Name1'  =  Edm  .  String  ]    
            |  _Column :   'Id'    
            |     |  _Var(  Join1  ).  Extent1  .  Id    
            |  _Column :   'Name'    
            |     |  _Var(  Join1  ).  Extent1  .  Name    
            |  _Column :   'Name1'    
              |  _Var(  Join1  ).  Extent2  .  Name,SELECT     
  "Extent1"."Id", "Extent1"."Name", "Extent2"."Name" AS "Name1"    
  FROM "SIMPLEQUERY"."Books" AS "Extent1" INNER JOIN "SIMPLEQUERY"."Authors" AS "Extent2" ON "Extent1"."Author_Id" = "Extent2"."Id"|
|DbGroupByExpression|  
|只支持select语句，返回,SelectStatement    
    
  先处理input节点，再处理keys，和aggregates|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ,   'C1'  =  Edm  .  Int32  ]}    
      |  _Project    
        |  _Input :   'GroupBy1'    
        |     |  _GroupBy    
        |       |  _Input :   'Extent1'  ,   'Extent1Group'    
        |       |     |  _Scan :   CodeFirstDatabase  .  Book    
        |       |  _Keys    
        |       |     |  _Key :   'K1'    
        |       |       |  _Var(  Extent1  ).  Id    
        |       |  _Aggregates    
        |         |  _Aggregate :   'A1'    
        |           |  _Edm.  Count  (  Collection  {  Edm  .  Int32  } collection)    
        |             |  _Arguments    
        |               |  _collection    
        |                 |  _1    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ,   'C1'  =  Edm  .  Int32  ]    
            |  _Column :   'Id'    
            |     |  _Var(  GroupBy1  ).  K1    
            |  _Column :   'C1'    
              |  _Var(  GroupBy1  ).  A1,  
,SELECT     
  "GroupBy1"."K1" AS "Id", "GroupBy1"."A1" AS "C1"    
  FROM (    
    SELECT "Extent1"."Id" AS "K1", COUNT(1) AS "A1"     
    FROM "SIMPLEQUERY"."Books" AS "Extent1"     
    GROUP BY "Extent1"."Id"    
  ) AS "GroupBy1"|
|DbElementExpression|  
|只支持select语句，返回,SelectStatement    
    
  添加默认column|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ,   'C1'  =  Edm  .  Int32  ]}    
      |  _Project    
        |  _Input :   'Filter1'    
        |     |  _Filter    
        |       |  _Input :   'Extent1'    
        |       |     |  _Scan :   CodeFirstDatabase  .  Author    
        |       |  _Predicate    
        |         |  _    
        |           |  _1    
        |           |  _  =    
        |           |  _Var(  Extent1  ).  Id    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ,   'C1'  =  Edm  .  Int32  ]    
            |  _Column :   'Id'    
            |     |  _Var(  Filter1  ).  Id    
            |  _Column :   'C1'    
              |  _Element :   Edm  .  Int32    
                |  _Limit    
                  |  _Project    
                  |     |  _Input :   'Filter2'    
                  |     |     |  _Filter    
                  |     |       |  _Input :   'Extent2'    
                  |     |       |     |  _Scan :   CodeFirstDatabase  .  Book    
                  |     |       |  _Predicate    
                  |     |         |  _    
                  |     |           |  _Var(  Filter1  ).  Id    
                  |     |           |  _  =    
                  |     |           |  _Var(  Extent2  ).  Author_Id    
                  |     |  _Projection    
                  |       |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ]    
                  |         |  _Column :   'Id'    
                  |           |  _Var(  Filter2  ).  Id    
                  |  _1,SELECT     
  "Extent1"."Id",     
  (    
    SELECT "Extent2"."Id"     
    FROM "Books" AS "Extent2"     
    WHERE "Extent1"."Id" = "Extent2"."Author_Id"     
    LIMIT 1    
  ) AS "C1"     
  FROM "Authors" AS "Extent1"     
  WHERE 1 = "Extent1"."Id"|
|DbCrossJoinExpression|  
|只支持select语句，返回,JoinFragment，拼join子句    
    
  先拼接input[0]节点，再拼接input[1]节点，再执行join condition节点|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ,   'Name'  =  Edm  .  String  ,   'Name1'  =  Edm  .  String  ]}    
      |  _Project    
        |  _Input :   'Filter1'    
        |     |  _Filter    
        |       |  _Input :   'Join1'    
        |       |     |  _CrossJoin    
        |       |       |  _Inputs    
        |       |         |  _Inputs[  0  ] :   'Extent1'    
        |       |         |     |  _Scan :   CodeFirstDatabase  .  Book    
        |       |         |  _Inputs[  1  ] :   'Extent2'    
        |       |           |  _Scan :   CodeFirstDatabase  .  Author    
        |       |  _Predicate    
        |         |  _    
        |           |  _Var(  Join1  ).  Extent1  .  Pages    
        |           |  _  >    
        |           |  _300    
        |  _Projection    
          |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ,   'Name'  =  Edm  .  String  ,   'Name1'  =  Edm  .  String  ]    
            |  _Column :   'Id'    
            |     |  _Var(  Filter1  ).  Extent1  .  Id    
            |  _Column :   'Name'    
            |     |  _Var(  Filter1  ).  Extent1  .  Name    
            |  _Column :   'Name1'    
              |  _Var(  Filter1  ).  Extent2  .  Name,  
,SELECT "Extent1"."Id", "Extent1"."Name", "Extent2"."Name" AS "Name1"     
  FROM "JOINTESTS"."Books" AS "Extent1" CROSS JOIN "JOINTESTS"."Authors" AS "Extent2"    
  WHERE "Extent1"."Pages" > 300|
|DbApplyExpression|  
|只支持select语句，返回,SelectStatement|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'customer_id'  =  Edm  .  Int32  ,   'country'  =  Edm  .  String  ]}    
      |  _Project    
        |  _Input :   'Sort1'    
        |     |  _Sort    
        |       |  _Input :   'Join3'    
        |       |     |  _LeftOuterJoin    
        |       |       |  _Left :   'Join2'    
        |       |       |     |  _LeftOuterJoin    
        |       |       |       |  _Left :   'Join1'    
        |       |       |       |     |  _InnerJoin    
        |       |       |       |       |  _Left :   'Apply1'    
        |       |       |       |       |     |  _OuterApply    
        |       |       |       |       |       |  _Input :   'Extent1'    
        |       |       |       |       |       |     |  _Scan :   CodeFirstDatabase  .customer    
        |       |       |       |       |       |  _Apply :   'Limit1'    
        |       |       |       |       |         |  _Limit    
        |       |       |       |       |           |  _Sort    
        |       |       |       |       |           |     |  _Input :   'Project1'    
        |       |       |       |       |           |     |     |  _Project    
        |       |       |       |       |           |     |       |  _Input :   'Filter1'    
        |       |       |       |       |           |     |       |     |  _Filter    
        |       |       |       |       |           |     |       |       |  _Input :   'Extent2'    
        |       |       |       |       |           |     |       |       |     |  _Scan :   CodeFirstDatabase  .address    
        |       |       |       |       |           |     |       |       |  _Predicate    
        |       |       |       |       |           |     |       |         |  _    
        |       |       |       |       |           |     |       |           |  _Var(  Extent2  ).address_id    
        |       |       |       |       |           |     |       |           |  _  =    
        |       |       |       |       |           |     |       |           |  _Var(  Extent1  ).address_id    
        |       |       |       |       |           |     |       |  _Projection    
        |       |       |       |       |           |     |         |  _NewInstance :   Record  [  'address_id'  =  Edm  .  Int32  ,   'city_id'  =  Edm  .  Int32  ]    
        |       |       |       |       |           |     |           |  _Column :   'address_id'    
        |       |       |       |       |           |     |           |     |  _Var(  Filter1  ).address_id    
        |       |       |       |       |           |     |           |  _Column :   'city_id'    
        |       |       |       |       |           |     |             |  _Var(  Filter1  ).city_id    
        |       |       |       |       |           |     |  _SortOrder    
        |       |       |       |       |           |       |  _Desc    
        |       |       |       |       |           |         |  _Var(  Project1  ).address_id    
        |       |       |       |       |           |  _1    
        |       |       |       |       |  _Right :   'Extent3'    
        |       |       |       |       |     |  _Scan :   CodeFirstDatabase  .store    
        |       |       |       |       |  _JoinCondition    
        |       |       |       |         |  _    
        |       |       |       |           |  _Var(  Apply1  ).  Extent1  .store_id    
        |       |       |       |           |  _  =    
        |       |       |       |           |  _Var(  Extent3  ).store_id    
        |       |       |       |  _Right :   'Extent4'    
        |       |       |       |     |  _Scan :   CodeFirstDatabase  .city    
        |       |       |       |  _JoinCondition    
        |       |       |         |  _    
        |       |       |           |  _Var(  Join1  ).  Apply1  .  Limit1  .city_id    
        |       |       |           |  _  =    
        |       |       |           |  _Var(  Extent4  ).city_id    
        |       |       |  _Right :   'Extent5'    
        |       |       |     |  _Scan :   CodeFirstDatabase  .country    
        |       |       |  _JoinCondition    
        |       |         |  _    
        |       |           |  _Var(  Join2  ).  Extent4  .country_id    
        |       |           |  _  =    
        |       |           |  _Var(  Extent5  ).country_id    
        |       |  _SortOrder    
        |         |  _Desc    
        |           |  _Var(  Join3  ).  Join2  .  Join1  .  Apply1  .  Extent1  .customer_id    
        |  _Projection    
          |  _NewInstance :   Record  [  'customer_id'  =  Edm  .  Int32  ,   'country'  =  Edm  .  String  ]    
            |  _Column :   'customer_id'    
            |     |  _Var(  Sort1  ).  Join2  .  Join1  .  Apply1  .  Extent1  .customer_id    
            |  _Column :   'country'    
              |  _Var(  Sort1  ).  Extent5  .country,SELECT     
  "Apply1"."customer_id", "Extent5"."country"     
  FROM (    
    SELECT "Extent1"."customer_id", "Extent1"."store_id", "Extent1"."first_name", "Extent1"."last_name", "Extent1"."email", "Extent1"."address_id", "Extent1"."active", "Extent1"."create_date", "Extent1"."last_update",     
    (    
      SELECT "Project1"."address_id"     
      FROM "SAKILA"."address" AS "Project1"     
      WHERE "Project1"."address_id" = "Extent1"."address_id"     
      ORDER BY "Project1"."address_id" DESC LIMIT 1    
    ) AS "ADDRESS_ID1",     
    (    
      SELECT "Project1"."city_id"     
      FROM "SAKILA"."address" AS "Project1"     
      WHERE "Project1"."address_id" = "Extent1"."address_id"     
      ORDER BY "Project1"."address_id" DESC LIMIT 1    
    ) AS "city_id"     
    FROM "SAKILA"."customer" AS "Extent1"    
  ) AS "Apply1"     
  INNER JOIN "SAKILA"."store" AS "Extent3" ON "Apply1"."store_id" = "Extent3"."store_id"     
  LEFT OUTER JOIN "SAKILA"."city" AS "Extent4" ON "Apply1"."city_id" = "Extent4"."city_id"     
  LEFT OUTER JOIN "SAKILA"."country" AS "Extent5" ON "Extent4"."country_id" = "Extent5"."country_id"     
  ORDER BY "Apply1"."customer_id" DESC|
|DbDistinctExpression|  
|只支持select语句，返回,SelectStatement，拼Distinct    
    
  先拼接input节点（from表达式），再标记IsDistinct，    
  再writeSql时再拼接distinct|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'C1'  =  Edm  .  Int32  ,   'C2'  =  Edm  .  Int32  ]}    
      |  _Project    
        |  _Input :   'Distinct1'    
        |     |  _Distinct    
        |       |  _Project    
        |         |  _Input :   'UnionAll1'    
        |         |     |  _UnionAll    
        |         |       |  _Project    
        |         |       |     |  _Input :   'Extent1'    
        |         |       |     |     |  _Scan :   CodeFirstDatabase  .  Book    
        |         |       |     |  _Projection    
        |         |       |       |  _NewInstance :   Record  [  'C1'  =  Edm  .  Int32  ,   'Id'  =  Edm  .  Int32  ]    
        |         |       |         |  _Column :   'C1'    
        |         |       |         |     |  _1    
        |         |       |         |  _Column :   'Id'    
        |         |       |           |  _Var(  Extent1  ).  Id    
        |         |       |  _Project    
        |         |         |  _Input :   'Extent2'    
        |         |         |     |  _Scan :   CodeFirstDatabase  .  Company    
        |         |         |  _Projection    
        |         |           |  _NewInstance :   Record  [  'C1'  =  Edm  .  Int32  ,   'Id'  =  Edm  .  Int32  ]    
        |         |             |  _Column :   'C1'    
        |         |             |     |  _1    
        |         |             |  _Column :   'Id'    
        |         |               |  _Var(  Extent2  ).  Id    
        |         |  _Projection    
        |           |  _NewInstance :   Record  [  'C1'  =  Edm  .  Int32  ,   'C2'  =  Edm  .  Int32  ]    
        |             |  _Column :   'C1'    
        |             |     |  _Var(  UnionAll1  ).  C1    
        |             |  _Column :   'C2'    
        |               |  _Var(  UnionAll1  ).  Id    
        |  _Projection    
          |  _NewInstance :   Record  [  'C1'  =  Edm  .  Int32  ,   'C2'  =  Edm  .  Int32  ]    
            |  _Column :   'C1'    
            |     |  _Var(  Distinct1  ).  C1    
            |  _Column :   'C2'    
              |  _Var(  Distinct1  ).  C2,  
,SELECT    
  "Distinct1"."C1","Distinct1"."C2"    
  FROM (    
    SELECT DISTINCT "UnionAll1"."C1","UnionAll1"."Id" AS "C2"    
    FROM (    
      (SELECT1 AS "C1","Extent1"."Id" FROM "Books" AS "Extent1")     
      UNION ALL     
      (SELECT 1 AS "C1","Extent2"."Id" FROM "Companies" AS "Extent2")    
    ) AS "UnionAll1"    
  ) AS "Distinct1"|
|DbUnionAllExpression,  
,todo：union distinct不支持|  
|只支持select语句，返回,UnionFragment,，左右子查询分别是个SelectStatement||


  


#### 3.1、Generator的实现及其示例

|Generator|实现|示例|
|---|---|---|
|SelectGenerator|1、调用DbProjectExpression的visit,2、分组展平优化，删除一些嵌套的关联查询,（todo: ef6框架是否自带优化？）|DbQueryCommandTree    
  |  _Parameters    
  |  _Query :   Collection  {  Record  [  'Id'  =  Edm  .  Int32  ,   'Name'  =  Edm  .  String  ,   'MinAge'  =  Edm  .  Int32  ,   'Weight'  =  Edm  .  Single  ,   'CreatedDate'  =  Edm  .  DateTime  ]}    
      |  _Project    
        |  _Input :   'Filter1'    
        |  _Projection    
            
  SELECT     
  "Extent1"."Id", "Extent1"."Name", "Extent1"."MinAge", "Extent1"."Weight", "Extent1"."CreatedDate"     
  FROM "UPDATETESTS"."m_product" AS "Extent1"     
  WHERE ? = "Extent1"."Name"|
|InsertGenerator|按树形结构顺序解析，调用对应的visit|DbInsertCommandTree    
  |  _Parameters    
  |  _Target :   'target'    
  |     |  _Scan :   CodeFirstDatabase  .  Product    
  |  _SetClauses    
  |     |  _DbSetClause    
  |     |     |  _Property    
  |     |     |     |  _Var(target).  Name    
  |     |     |  _Value    
  |     |       |  _  'Acme'    
  |     |  _DbSetClause    
  |     |     |  _Property    
  |     |     |     |  _Var(target).  MinAge    
  |     |     |  _Value    
  |     |       |  _0    
  |     |  _DbSetClause    
  |     |     |  _Property    
  |     |     |     |  _Var(target).  Weight    
  |     |     |  _Value    
  |     |       |  _0    
  |     |  _DbSetClause    
  |       |  _Property    
  |       |     |  _Var(target).  CreatedDate    
  |       |  _Value    
  |         |  _0001  /  1  /  1     0  :  00  :  00    
  |  _Returning    
      |  _NewInstance :   Record  [  'Id'  =  Edm  .  Int32  ]    
        |  _Column :   'Id'    
          |  _Var(target).  Id,  
    
  INSERT INTO "UPDATETESTS"."m_product"(    
  "Name", "MinAge", "Weight", "CreatedDate"    
  ) VALUES (    
  ?, 0, 0, ?)     
  RETURNING "Id" into ?|
|UpdateGenerator|按树形结构顺序解析，调用对应的visit|DbUpdateCommandTree    
  |  _Parameters    
  |  _Target :   'target'    
  |     |  _Scan :   CodeFirstDatabase  .  Product    
  |  _SetClauses    
  |     |  _DbSetClause    
  |       |  _Property    
  |       |     |  _Var(target).  Name    
  |       |  _Value    
  |         |  _  'Acme 2'    
  |  _Predicate    
  |     |  _    
  |       |  _Var(target).  Id    
  |       |  _  =    
  |       |  _1    
  |  _Returning,  
  UPDATE "UPDATETESTS"."m_product" SET "Name"=? WHERE "Id" = 1|
|DeleteGenerator|按树形结构顺序解析，调用对应的visit|DbDeleteCommandTree    
  |  _Parameters    
  |  _Target :   'target'    
  |     |  _Scan :   CodeFirstDatabase  .  Product    
  |  _Predicate    
      |  _    
        |  _Var(target).  Id    
        |  _  =    
        |  _1,  
  DELETE FROM "UPDATETESTS"."m_product" WHERE "Id" = 1|
