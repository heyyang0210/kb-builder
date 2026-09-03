Created by 钟金健, last modified by  刘登科 on 五月 21, 2024

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

支持(+)外连接语法。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

**功能特性**

该语法是外连接的特殊写法。该语法只支持左外连接或右外连接，不允许全外连接。  该语法作用于where子句上时，不可以和ANSI连接语法共用。

  


|功能||用例|基础版（已交付）|oracle|2022/12/07版|2024 23.2.3.100补丁版本|
|:---:|---|---|---|---|---|---|
|(+)作用于where子句filter|普通用法|select * from a, b where a.id = b.id(+)|支持|支持|支持|与上一个版本保持一致|
||(+)作用的filer类型|select * from a,b where     [a.id](http://a.id)    xxx    [b.id](http://b.id)    ;|只能作用于比较运算(=、!=、＞、≥、＜、≤)|支持  **比较、(not) like、is (not) null、between、in、all、bool表达式**  （详细支持filer类型看下面    [表格1](https://conf.yasdb.com/pages/viewpage.action?pageId=98503178#YDBRD7614,YDBRD27587设计文档-table1)    ）|支持比较运算|**支持：**,**FILTER_IN：左边列含(+)**    
  **FILTER_NOT_IN：左边列含(+)**    
  **FILTER_LIKE：左右两边，且嵌套内置函数**    
  **FILTER_NOT_LIKE：左右两边，且嵌套内置函数**    
  **FILTER_IS_NULL,**    
  **FILTER_IS_NOT_NULL**|
|(+)作用于on子句filter|普通用法|select * from a join b on a.id = b.id(+)|不支持|支持|支持|与上一个版本保持一致|
||支持on子句上join的种类|select * from a   xxx join   on     [a.id](http://a.id)     =     [b.id](http://b.id)    (+) |不支持|支持，join的种类有  **left(right) join、full join、inner join**  （详细支持join类型看下面    [表格3](https://conf.yasdb.com/pages/viewpage.action?pageId=98503178#YDBRD7614,YDBRD27587设计文档-table3)    ）|支持left (right) join、 full join、inner join、 join|与上一个版本保持一致|
||(+)作用的filter类型|select * from a join on a.id   xxx   b.id(+)|不支持|支持  **比较、(not) like、is (not) null、between、in、all、bool表达式**  （详细支持filer类型看下面    [表格1](https://conf.yasdb.com/pages/viewpage.action?pageId=98503178#YDBRD7614,YDBRD27587设计文档-table1)    ）|支持比较运算|**支持：**,**FILTER_IN：左边列含(+)**    
  **FILTER_NOT_IN：左边列含(+)**    
  **FILTER_LIKE：左右两边，且嵌套内置函数**    
  **FILTER_NOT_LIKE：左右两边，且嵌套内置函数**    
  **FILTER_IS_NULL,**    
  **FILTER_IS_NOT_NULL**|
|谓词有(+)的一边只能支持一个column||select * from a,b,c where a.id = b.id(+) + c.id;|只支持一个column|支持多个column|支持多个column|与上一个版本保持一致|
|打印计划的时候是否需要打印(+)标识||\|不支持|支持|不打印|与上一个版本保持一致|
|(+)作用于Group by列||不支持|不支持|支持|不支持|**支持**|


### **作用于where子句filter**

**基本语法**

用例1：select * from a, b where a.id = b.id(+)

在用例1中，表示a左外连接b，连接条件是a.id = b.id。即等价于select * from a left join b on a.id = b.id;

表示对应的表的column没有数据匹配时补空。

多个谓词可以通过and和or关键词连接（or关键词oracle表现存在待确认点，有时候支持谓词通过or连接，有时候不支持通过or连接）

**多表关系**

不允许两个表互相外连接

不允许表自己与自己外连接

```
select * from a,b,c from a.id = b.id(+) and a.id = c.id(+);--基础版已支持

select * from a,b,c from a.id = b.id(+) and a.id = c.id(+) and a.id(+) = c.id;–报错，a,b,c互相外连接

select * from a, b where a.date > add_months(a.date(+), b.id); --不支持

select * from a, b where a.date > add_months(a.date, b.id(+)); --完整版需要支持
```

  


**使用场景：**

（yasdb支持的filter类型：比较(>、=、<、≥、≤、!=)、like、rlike、is null、between、in、exists、any、all、bool表达式，谓词连词and、or   ) (FILTER_INVERT这是什么filter类型) 

该特性支持的filter类型:



表格1

|filter类型|比较|like\not like|rlike\not rlike|is null\ is not null|exists\not exists|between|in|any|all|bool表达式|
|---|---|---|---|---|---|---|---|---|---|---|
|oracle是否支持|√|√|×(mysql的语法)|√( 该谓词不涉及两表关系 )|×|√|部分支持|×|√|√|
|yasdb现版本是否支持|√|×|×|×|×|×|部分支持|×|×|×|
|说明|  
|  
|  
|  
|  
|a.id between b.id and c.id(+),可以改写为比较运算的and,  
,  
|只支持能改写成=和!=的类型，具体来说是两边都是column或包含列的表达式的情况。|any改写为or|all改写为and|  
|
|  
|如果谓词不涉及两表关系的运算，则(+)会忽略，表现等同于没有(+)，计划里面就没有(+)||||||||||


表格2

|连词类型|AND|OR|
|---|---|---|
|是否支持|√|×|


  


**特殊场景：**

- 特殊场景如select * from a, b where     [a.id](http://a.id)     (not) in     [b.id](http://b.id)    (+) 其中的(not) in会优化为=或者!= ，所以支持in的这种特殊场景


特殊场景的限制条件一：同一个谓词上的(+)必须作用于同一个表上，且谓词中有(+)的表所有出现的列都必须加上（+），否则会处理成自己与自己外连接进而报错。（  **这里是完整版与基础版不同的地方**  ）

![](https://pingcode.yasdb.com/atlas/files/public/67396d418970c2af4f521188/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBSUFBQUFBQUFZQUFBQUFBQUFCQkFBQUFBQUFCQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFNSUFBQUFBQUFBQUlBQUFBQUJBQUJBQUFBUUFBQUFnQUFJQUFBQUFnRUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFnQUFBQUNDQUFBQUFBQUFBQUFBQUFBQVFCQUFBQUFBQUFBQUFBQUFKSUFBQUFCRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5NzEsImV4cCI6MTc4MjMxNzc3MX0.QtlbIXO1drPPh-A1-UXrcuBWq7b2y_Ev08LRS9fz5Rs)

特殊场景的限制条件二：

在Oracle下：(+)使用在case when的时候报错不符合实际

![](https://pingcode.yasdb.com/atlas/files/public/67396d41a1ad9a3311dc8ff7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBSUFBQUFBQUFZQUFBQUFBQUFCQkFBQUFBQUFCQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFNSUFBQUFBQUFBQUlBQUFBQUJBQUJBQUFBUUFBQUFnQUFJQUFBQUFnRUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFnQUFBQUNDQUFBQUFBQUFBQUFBQUFBQVFCQUFBQUFBQUFBQUFBQUFKSUFBQUFCRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5NzEsImV4cCI6MTc4MjMxNzc3MX0.QtlbIXO1drPPh-A1-UXrcuBWq7b2y_Ev08LRS9fz5Rs)

这样没问题

![](https://pingcode.yasdb.com/atlas/files/public/67396d42a1ad9a3311dc8ff8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBSUFBQUFBQUFZQUFBQUFBQUFCQkFBQUFBQUFCQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFNSUFBQUFBQUFBQUlBQUFBQUJBQUJBQUFBUUFBQUFnQUFJQUFBQUFnRUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFnQUFBQUNDQUFBQUFBQUFBQUFBQUFBQVFCQUFBQUFBQUFBQUFBQUFKSUFBQUFCRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5NzEsImV4cCI6MTc4MjMxNzc3MX0.QtlbIXO1drPPh-A1-UXrcuBWq7b2y_Ev08LRS9fz5Rs)

结论：case when中的各个分支不是或的含义，也符合（+）作用于一个表时，这个表的其他列如果出现在表达式中时也要都使用（+）

### **作用于on子句filter**

**基本语法**

用例2：select * from a join b on a.id=b.id(+);

在用例2中，表示a左外连接b，连接条件是a.id = b.id，即等价于select * from a left join b on a.id = b.id;

表示对应的表的column没有数据匹配时补空

**多表关系**

不允许两个表互相外连接

如果要将(+)语法作用于on条件filter，如a xxx join b on     [a.id](http://a.id)     =     [b.id](http://b.id)    (+)，其中a和b都只能是一个单表，不可以是多表join之后的结果

```
select * from a left join b on a.id(+) = b.id; -- 报错，a, b互相外连接

select * from a join b on a.id(+) = b.id; -- 完整版需要支持

select * from a join (c join b on 1=1) on a.id(+)=1; -- 不支持,ansi join两边的表只能是普通表
```

**使用场景：**

(用例：select * from a   xxx join   on a.id xxx b.id(+)  )



**表格3：**

|join类型|**left(right) join**|**full join**|**cross join**|**inner join**|**natural inner(outer) join**|
|---|---|---|---|---|---|
|on子句filter是否支持(+)|√|√|×(没有on子句)|√|×(不需要on子句)|
|优先级|(+)语法与ansi语法共同作用，但是不能出现互相外连接的情况|(+)语法限制高于full join|\|(+)语法限制高于inner join|\|


  


注:

“(+)语法限制高于full join”：select * from a full join b on a.id = b.id(+);      –– a，b表不是全外连接，实际上是a左外连接b表，因为(+)的限制范围比full join小

  


**计划是否需要支持打印(+)符号标识**

##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

添加了AnlTableMatrix结构体，进行矩阵表示。 （有向无环图的节点与边的信息使用矩阵保存）

![](https://pingcode.yasdb.com/atlas/files/public/67396d428970c2af4f52118a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBSUFBQUFBQUFZQUFBQUFBQUFCQkFBQUFBQUFCQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFNSUFBQUFBQUFBQUlBQUFBQUJBQUJBQUFBUUFBQUFnQUFJQUFBQUFnRUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFnQUFBQUNDQUFBQUFBQUFBQUFBQUFBQVFCQUFBQUFBQUFBQUFBQUFKSUFBQUFCRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5NzEsImV4cCI6MTc4MjMxNzc3MX0.QtlbIXO1drPPh-A1-UXrcuBWq7b2y_Ev08LRS9fz5Rs)

- rowMaps是一个数组，表示矩阵的所有行，数组中的一个元素就是一行。


- activeRows表示有(+)操作符作用于的表


- tableCount表示矩阵中表的数量


添加了OuterRelContext结构体，挂在AnlVerifier上，承载正在verify的DS的(+)操作符相关信息的上下文

![](https://pingcode.yasdb.com/atlas/files/public/67396d42a1ad9a3311dc8ffa/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBSUFBQUFBQUFZQUFBQUFBQUFCQkFBQUFBQUFCQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFNSUFBQUFBQUFBQUlBQUFBQUJBQUJBQUFBUUFBQUFnQUFJQUFBQUFnRUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFnQUFBQUNDQUFBQUFBQUFBQUFBQUFBQVFCQUFBQUFBQUFBQUFBQUFKSUFBQUFCRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5NzEsImV4cCI6MTc4MjMxNzc3MX0.QtlbIXO1drPPh-A1-UXrcuBWq7b2y_Ev08LRS9fz5Rs)

- outerRelTableMatrix是一个矩阵，以表为节点，表与表之间的(+)作用关系是一个偏序关系，抽象作为边。
- inactiveOuterRelMap临时记录二元操作符左右两边verify过程中没有被(+)操作符作用的表的信息，在and/or二元操作符的时候使用
- activeOuterRelTableId临时记录二元操作符左右两边verify过程中已经被(+)操作作用的表信息，在and/or二元操作符的时候使用


  


```
static CodResult verifyAdjustOuterRel(AnlVerifier* vrfr, AnlTableBitmap* leftInactiveMap, CodBool leftHasOuterRel, CodUint8 leftActiveId)
```

verifyAdjustOuterRel：在（+）操作符作用与join on条件内的filter时，需要进行一些调整。

例如：对于  xxx from a join b on a.id = b.id(+) and a.data = b.data的时候，要调整为xxx from a join b on a.id = b.id = and a.data = b.data

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d428970c2af4f52118b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUVBSUFBQUFBQUFZQUFBQUFBQUFCQkFBQUFBQUFCQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFNSUFBQUFBQUFBQUlBQUFBQUJBQUJBQUFBUUFBQUFnQUFJQUFBQUFnRUFBQUFBQUFBQUFBQUFBQ0FBQUFBQUFnQUFBQUNDQUFBQUFBQUFBQUFBQUFBQVFCQUFBQUFBQUFBQUFBQUFKSUFBQUFCRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY5NzEsImV4cCI6MTc4MjMxNzc3MX0.QtlbIXO1drPPh-A1-UXrcuBWq7b2y_Ev08LRS9fz5Rs)

- 在AnlVerifier上添加了hasOuterRel标志位，临时记录二元操作符左右两边verify过程中是否存在(+)操作符


```
static CodResult verifyDsColumnOuterRel(AnlVerifier* vrfr, ExprNode* node)
```

verifyDsColumnOuterRel函数在verify 表column的时候及将一些必要信息从记录下来。

  


```
static CodResult verifyOuterRel(AnlVerifier* vrfr)
```

verifyOuterRel函数将二元运算符（例如>、<、=等）产生的(+)作用的两表之间的偏序关系添加到矩阵中。

  


```
static CodResult verifyMakeOuterJoinTree(AnlVerifier* vrfr, JoinNode** root)
```

verifyMakeOuterJoinTree函数将矩阵的偏序信息通过拓扑排序算法生成一棵join树

  


##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- 该语法只能表示该两个表左连接与右连接，无法表示两个表全外连接。
- ~~(+)语法在yasdb中目前只能用于where子句后的比较谓词（ = 、>、<、≥、≤）~~


- ~~目前比较运算符两边不允许同时都出现(+)操作符，出现(+)操作符的一边只允许出现一个column，即select * from a,b,c where a.id = b.id + c.id(+)（暂不支持，报错）  select * from a,b,c where ~~    [a.id](http://a.id)    ~~ - ~~    [b.i](http://b.id)    ~~d = ~~    [c.id](http://c.id)    ~~(+) --支持~~
- (+)只允许放在column后，不允许放在表达式、常量后，即不支持select * from a,b,c where a.id = 1(+); 
- （+）语法只允许使用and连接有(+)的谓词，使用or连接会报错。


##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

**设计关键点概述：**

**生成有向图**  ：偏序关系外连接的表与另一个表示形成一个偏序关系

**生成拓扑排序**  ：有向无环图生成拓扑排序

**生成join树**  ：通过拓扑排序生成正确的join tree

**谓词下推**  ：将where子句中的filter下推到对应的join tree节点中

详细原理分析查看：    [(+)外连接实现原理:拓扑排序 - 钟金健 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=95115314)  

##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

客户场景一：

CREATE FORCE VIEW "SSMSTRAN"."RFM_ENTITY" ("HG_SID", "HG_ENTITYID", "HG_COMPANYNAME", "HG_ISCRC", "HG_REGISTRATION", "HG_ISLISTING", "HG_ISCONSOLIDATED", "HG_BUSINESSCONDITION", "HG_DATEESTABLISHMENT", "HG_SFDLYX", "HG_CREDITID", "HGXT_SSLRZX") AS     
  select     [e.id](http://e.id)     HG_SID,    
    [e.id](http://e.id)     HG_ENTITYID,    
  trim(getobjname(E.ID)) HG_COMPANYNAME,    
  case when e.group_crc='402894822ff7504b012ff77cd0110006' then '1'    
  when e.group_crc='402894822ff7504b012ff77d02c8000a' then '0'    
  else '99' end as HG_ISCRC,    
  GETSELECTNAME(E.COMPANYREGISTRATIONTYPES) HG_REGISTRATION,    
  E.ISLISTING HG_ISLISTING,    
  case when s.isincludefinalaccounts='402894822ff7504b012ff77cd0110006' then '1'    
  when s.isincludefinalaccounts='402894822ff7504b012ff77d02c8000a' then '0'    
  else '99' end as HG_ISCONSOLIDATED,    
  getselectname(e.businessconditions) HG_BUSINESSCONDITION,    
  e.dateestablishment HG_DATEESTABLISHMENT,    
  case when e.share_strct_type='8a80be314eb4c156014efb8022bd0198' then 1 else 0 end as HG_SFDLYX,    
  case when e.companyregistrationtypes='402880073116cd65013116f757020077' then nvl(s.businesslicense,e.businesslicense) else '' end as HG_CREDITID,    
    [b.name](http://b.name)     HGXT_SSLRZX    
  from entity e,sasacinformation s,basicdate b    
  where 1=1    
  --and e.businessconditions in ('40288ab3319793ff01319873cf6901f0')    
  and e.oldentityid is null    
  and     [e.id](http://e.id)    =s.entityid  (+)    
  and e.entitytype='402880073116cd65013116ec421f0019'    
  and     [b.id](http://b.id)    =e.belongsdepartmentone

;

客户场景二：    [[REQUIRE-89] 【深燃-CIS】支持（+）操作符的外连接 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/REQUIRE-89)  

客户场景三：    [[REQUIRE-93] 【长亮科技】支持（+）操作符的外连接 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/REQUIRE-93)  

### **自测功能点设计：**

（+）作用于where子句filter

（+）作用于on子句filter

##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

  


##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

  


## Attachments:

[image2022-11-24_11-8-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2ZhMWFkOWEzMzExZGM4ZmRkIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.ciB3bhxkyZFM7GncuzkdJ0Zh8s81mPmBd5DJdFe9vA8)

 (image/png)    


[image2022-11-24_11-8-34.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2Y4OTcwYzJhZjRmNTIxMTZkIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.bn__jnqbi53kNqmhefukDWp9Ok8WCSAFdiBb8j3UO2o)

 (image/png)    


[image2022-11-24_11-8-18.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2Y4OTcwYzJhZjRmNTIxMTZlIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.OQxfHpqiG0CiK2N1Wa5cpQrUitpT3RqEq7xJPgVtQU0)

 (image/png)    


[image2022-11-24_11-7-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2ZhMWFkOWEzMzExZGM4ZmUwIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.Lxly2277vhYOXDgZ0wzKhSrXePIdvthe2es7nZMdbkc)

 (image/png)    


[image2022-11-24_11-6-43.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkM2Y4OTcwYzJhZjRmNTIxMTZmIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.kmrZTU4KS6O_td8aJiYJ_peXriMyMLhoaf5Md9X4MvI)

 (image/png)    


[image2022-11-24_11-4-35.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDA4OTcwYzJhZjRmNTIxMTcwIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.GLYlXFTyLEmzveNvpfSUryWGNWgfi8tzcPIQdhuci4c)

 (image/png)    


[image2022-11-18_17-33-7.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDBhMWFkOWEzMzExZGM4ZmUyIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.T7h6SXhgNMX7WpLQRWcaczgIedYOk4Qn768QEDqcCq0)

 (image/png)    


[image2022-11-18_17-31-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDBhMWFkOWEzMzExZGM4ZmUzIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.USPi6saH9C9fq_fTAWS9iVSpyHrmsODUFALNR0zSDlQ)

 (image/png)    


[image2022-11-18_17-30-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDA4OTcwYzJhZjRmNTIxMTcxIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.ItAKm15aID9Vu0bp4Zz0QFxDFdAm3SMEJA9wli1ryBA)

 (image/png)    


[mytest_feat_(+).txt](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDA4OTcwYzJhZjRmNTIxMTcyIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.5p_D5aNS1DQJTEYDzTGYnS3-7cx0PtNfB2ApinismjM)

 (text/plain)    


[image2022-11-24_16-39-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDA4OTcwYzJhZjRmNTIxMTc0IiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.QyTnFZ3bMpTYXbS58NYWtsXucTYxzQBcMQprIKMcZxI)

 (image/png)    


[image2022-11-24_16-31-56.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDA4OTcwYzJhZjRmNTIxMTc1IiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.TNISqHEwkyvSrkvoXs36gKUyHSRragXQDgXVD3yL24Y)

 (image/png)    


[image2022-11-24_16-2-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDBhMWFkOWEzMzExZGM4ZmU2IiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.KmE2RApTZu0bkyuV9_2Kf6VhU4N0xoKebSuOSliBqrQ)

 (image/png)    


[image2022-11-24_16-2-3.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDA4OTcwYzJhZjRmNTIxMTc2IiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.xtJ5CJQC2B7JAphv1wUQvyle7Hiiw6JVl1mtCn94psI)

 (image/png)    


[image2022-11-24_16-0-27.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDA4OTcwYzJhZjRmNTIxMTc3IiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.lLOJjPxnyKuuvsVl1PraWlA65FNQomSO-Uh0EygLtVE)

 (image/png)    


[image2022-11-24_15-59-15.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDBhMWFkOWEzMzExZGM4ZmU4IiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.irQCNM2ZNJZb9aAt57RHoLD72OsQMT2Y_y-jHaMnVbo)

 (image/png)    


[image2022-11-24_15-58-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDA4OTcwYzJhZjRmNTIxMTc5IiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.TFmIOPYNh_dS3xCqw1piiOElNTA1R77yxfuvmdu8H_E)

 (image/png)    


[image2022-11-24_15-57-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDBhMWFkOWEzMzExZGM4ZmU5IiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.SNv_Ww7Z21bs11luCzX_bz7sb3IEn9Wc3eeqaKkcTo0)

 (image/png)    


[image2022-11-24_15-55-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDE4OTcwYzJhZjRmNTIxMTdjIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.mr2ES5neTg54NRuWiFciV_c_DADprYtzKtmvAOa4Oqs)

 (image/png)    


[image2022-11-24_15-55-4.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDE4OTcwYzJhZjRmNTIxMTdkIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.xlugGCCLPxi3kZHxssuLfwFeuwj8siIICtjgcIdm54Y)

 (image/png)    


[image2022-11-24_15-54-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDFhMWFkOWEzMzExZGM4ZmVjIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.Ye5gZJd6SBA-RYgrLIrVz-Ug67t441itQV1JNnVZakI)

 (image/png)    


[image2022-11-24_15-51-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDE4OTcwYzJhZjRmNTIxMTdlIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.YrgjcGl6H6BstV2b7gOpVB2LJzuSbr4ZP-I1cj6WtgE)

 (image/png)    


[image2022-11-24_14-12-39.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDE4OTcwYzJhZjRmNTIxMTdmIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.0ai86vmID5lQVnniEJHpKF2pJCGSmtHDygaAFbiZOBc)

 (image/png)    


[image2022-11-24_11-57-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDFhMWFkOWEzMzExZGM4ZmVkIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.DWng722ys9XBTFjVuD4HQIR5th3IcS6gqqGHU3ytaWs)

 (image/png)    


[image2022-11-24_11-52-54.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDFhMWFkOWEzMzExZGM4ZmVlIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.uD-fBIj8JdsA_8S6dMHibup28HM0XiOZ9vyNIUyP9WA)

 (image/png)    


[image2022-11-24_11-51-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDE4OTcwYzJhZjRmNTIxMTgwIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.t2HibQ4HjuyoK7Txp-TYiPtCMJ3dP4GmIyuM_UjFr94)

 (image/png)    


[image2022-11-24_11-51-51.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDFhMWFkOWEzMzExZGM4ZmVmIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9._6XWwj3HTaDbxwoCUCg1NAc0pP8kfN7aBJ6_MpDGw7w)

 (image/png)    


[image2022-11-24_11-50-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDFhMWFkOWEzMzExZGM4ZmYwIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.1VWy0xDFxxM5KBFzqos8tVoGsc9HvyXfBzBJWmkG29g)

 (image/png)    


[image2022-11-24_11-41-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDFhMWFkOWEzMzExZGM4ZmYxIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.z_kiysLeab9-p4BYxZ6FeK0F6IOWUHQtRx_CB43jxgA)

 (image/png)    


[image2022-11-24_11-41-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDE4OTcwYzJhZjRmNTIxMTgzIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.tA01J9Bg8Hsw1P4peDz-eWpq58-5sCygG9z8Tpw0ciY)

 (image/png)    


[image2022-11-24_11-22-8.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNDFhMWFkOWEzMzExZGM4ZmYzIiwicmVmX2lkIjoiNjczOTZkM2Y1OTNmOTljOWZmMjM3OTYxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA2OTcxLCJleHAiOjE3ODIzOTMzNzF9.jc5VvgEloEtfOzTrn9Wc2ARuD8P5_H606tmsZknoO9Q)

 (image/png)    
