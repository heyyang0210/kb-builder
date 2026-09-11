Created by 吴昊旻, last modified on 五月 13, 2024

*详细设计-YDBRD-7775: 集合操作下推方案设计*

*IR链接：*    [https://pingcode.yasdb.com/pjm/items/6611056b579a3edb84d4b7cc](https://pingcode.yasdb.com/pjm/items/6611056b579a3edb84d4b7cc)    *? #YDBRD-12216 调整filter优化与outer转inner顺序*

*SR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7483009f91eb87f2c095](https://pingcode.yasdb.com/ship/ideas/660b7483009f91eb87f2c095)    *? #YASHAN-1417 TPCDS优化-外连接的filter没有根据等价类下推 *

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#1-%E6%80%BB%E8%BF%B0)  

本需求旨在新的下推框架基础上，支持joinFilter（包括where谓词和on谓词）进行等价类扩展与谓词下推。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

需求由外场 问题单引入    [[YDBRD-27946] LEFT OUTER JOIN支持ON条件谓词扩展 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-27946?filter=-4&jql=text%20~%20%22outer%22%20order%20by%20created%20DESC)    。

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

无

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|joinFilter进行等价类扩展并下推|在新框架下，能保证joinOnFilter与whereFilter进行等价类扩展并尝试下推导到表上|是|是|
|性能|下推后性能|多扩展出的谓词提前过滤表数据|是|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#2-%E6%8E%A5%E5%8F%A3)  

##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#4-%E7%89%B9%E6%80%A7)  

###   [4.1 下推框架下的join filter移动](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

**设计思路：**

1. joinOp上的Filter可分为where filter和on filter，对于outer join，存在补空边和非补空边。不同类型的谓词需要分场景进行讨论。
1. 对于补空边，创建一个  **候补数组**  ，放置可进行等价类推导的谓词。其中  **候补数组中存放除了补空边where谓词以外的其他所有谓词**  。
1. outer join下推规则：
    1. 补空边on谓词推到补空边上
    1. 非补空边where谓词推到非补空边上
    1. 连接谓词（on/where）放再on上
1. inner join下推规则：
    1. 补空边on谓词+where谓词
    1. 非补空边on谓词+where谓词
    1. 连接谓词（on/where）放再on上
1. full join下推规则（*均为补空边）：
    1. where谓词on谓词均不可下推


  


|on filter||||
|---|---|---|---|
|非补空边的on filter（单表谓词）|1. 对于inner join，可将谓词推到该  **非补空边**  的表上。
1. 对于outer join，不可下推。只有尝试outer转inner之后才可下推。
1. 复制一份谓词存入候补数组中用于等价类扩展，在谓词下推之后会对候补数组中不可在该表上执行的谓词进行删除。可在该表上执行的谓词包括：filter false/filter true/属于该表的单表谓词
    1. select * from t1 left join t2 on t1.id = t2.id and t1.c1 = 1 where t1.c1 = 2; 候补数组中存放了    [t1.id](http://t1.id)     =     [t2.id](http://t2.id)     and t1.c1 = 1 and   t1.c1 = 2，由等价类可以推到出filter false，则删除其余无关谓词。
|||
|补空边的on filter,（单表谓词）|1. 对于inner join，可将谓词推到该  **补空边**  的表上。
1. 对于outer join，可将谓词推到该  **补空边**  的表上。
|||
|连接非补空边和补空边的on filter（t1.id = t2.id)|1. 对于inner join/outer join，不可将该谓词推到任意一边的表上。但是需要复制一份存入  **补空边**  的候补数组中进行等价类扩展，推导后再进行删除。
|||


|where filter||||
|---|---|---|---|
|非补空边的where filter（单表谓词）|1. 对于inner join/outer join，可将谓词推到该  **非补空边**  的表上。
1. 复制一份谓词存入  **补空边的候补数组**  中用于等价类扩展，后续再对补空边谓词处理时将不可执行的谓词进行删除。
|||
|补空边的where filter,（单表谓词）|1. 对于inner join，可将谓词推到该  **补空边**  的表上。
1. 对于outer join，不可下推。只有尝试outer转inner之后才可下推
|||
|连接非补空边和补空边的where filter（    [t1.id](http://t1.id)     =     [t2.id](http://t2.id)    )|1. 该谓词不可下推，放在join的on条件上
1. 基于该谓词尝试outer转inner，可以转inner的将候补谓词清空，用and连接on谓词和where谓词进行等价类扩展之后再下推；不可转inner的复制一份放在补空边的候补数组进行等价类扩展
|||


###   [4.2 下推框架下的outer转inner后的join filter下推](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)  

**设计思路：**

1. 根据投影尝试outer转inner
1. 处理where/on谓词，包括等价类扩展与候补数组的谓词放置
1. 尝试outer转inner，基于outer转inner之后的结果对谓词进行下推


  


|where filter,1.先对where谓词进行等价类扩展,2.对扩展后的谓词split出三份，包括补空边filter, 非补空边filter, 连接非补空边和补空边的filter（均为temp filter），清空原where谓词,3.基于where谓词进行outer转inner||
|---|---|
|原join flag = full /left/right outer，转换结果->|1. flag = inner
    1. 将连接非补空边和补空边的filter放在join on filter上
    1. 将补空边where filter, 非补空边where filter各自推到表上
1. flag =  left/right outer
    1. 将补空边filter放回where谓词上；
    1. 将非补空边filter推到表上；
    1. 将连接filter放到on上
    1. 将非补空边的谓词和连接filter复制一份放到补空边的候补数组中；
1. flag  = full outer   **(**  **full outer join两边均为补空边)**    

    1. 由于full outer join两边均为补空边，所以单表where谓词均不可下推，加出result 挂上
    1. ![](https://pingcode.yasdb.com/atlas/files/public/67396d728970c2af4f5212ac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFCQUlBQUFBQUFBZ0FDQUZBQUFBQkFJQUFBQUFBQUlBQUFBQUFBQUNBQUFBRUFBQUJBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBRUFBSUFBQUFBQUFFQUFBQ0FBQUFBQkFBQUFBQUFBQVNBQUFBQUFBRUFBQUJBQUFFQUFBQUlBQWdDQUJBQUVJQUFBQUNBQVJBQUlBUkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1MDYsImV4cCI6MTc4MjMxOTMwNn0.2uQVnexkqhiRhuVAY0sK-XG6jKcxrCwATaPE_BU3FHk)
    1. 将连接filter放回on上
|
|原join flag = inner|1. 补空边filter/非补空边filter放到各自表上
1. 连接非补空边和补空边的filter放到on条件上
|


|on filter,1.先对on谓词进行等价类扩展,2.对扩展后的谓词split出三份，包括补空边filter, 非补空边filter, 连接非补空边和补空边的filter（均为temp filter），清空原on谓词,3.基于on谓词进行outer转inner||
|---|---|
|原join flag = full /left/right outer，转换结果->|1. flag = inner
    1. 当存在where filter时：清空补空边的候补数组，将where filter与on filter用and合并，进行等价类扩展之后基于inner的规则下推
    1. 当不存在where filter时：将on filter按inner的规则下推
1. flag =  left/right outer
    1. 当存在where filter时：将非补空边where filter + 所有的on filter copy一份存入候补数组进行等价类扩展，将候补数组中符合补空边条件的filter推到补空边上，将非补空边的filters（on + where）和连接filter放回on谓词。
    1. 当不存在where filter时，将所有的on filter copy一份存入候补数组进行等价类扩展，将候补数组中符合补空边条件的filter推到补空边上，将非补空边的filters（on）和连接filter放回on谓词。
1. flag  = full outer   **(**  **full outer join两边均为补空边，对两边均做flag =  left/right outer的操作）**
    1. 均不可下推，on filter放在on谓词上，若存在where filter加出resultOp挂上
,![](https://pingcode.yasdb.com/atlas/files/public/67396d728970c2af4f5212ae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFCQUlBQUFBQUFBZ0FDQUZBQUFBQkFJQUFBQUFBQUlBQUFBQUFBQUNBQUFBRUFBQUJBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBRUFBSUFBQUFBQUFFQUFBQ0FBQUFBQkFBQUFBQUFBQVNBQUFBQUFBRUFBQUJBQUFFQUFBQUlBQWdDQUJBQUVJQUFBQUNBQVJBQUlBUkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1MDYsImV4cCI6MTc4MjMxOTMwNn0.2uQVnexkqhiRhuVAY0sK-XG6jKcxrCwATaPE_BU3FHk),![](https://pingcode.yasdb.com/atlas/files/public/67396d728970c2af4f5212b0/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFCQUlBQUFBQUFBZ0FDQUZBQUFBQkFJQUFBQUFBQUlBQUFBQUFBQUNBQUFBRUFBQUJBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBRUFBSUFBQUFBQUFFQUFBQ0FBQUFBQkFBQUFBQUFBQVNBQUFBQUFBRUFBQUJBQUFFQUFBQUlBQWdDQUJBQUVJQUFBQUNBQVJBQUlBUkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1MDYsImV4cCI6MTc4MjMxOTMwNn0.2uQVnexkqhiRhuVAY0sK-XG6jKcxrCwATaPE_BU3FHk)|
|原join flag = inner|1. 当存在where filter时：清空补空边的候补数组，将where filter与on filter用and合并，进行等价类扩展之后基于inner的规则下推
1. 当不存在where filter时：将on filter按inner的规则下推
|


**功能图：**

**example 1**

![](https://pingcode.yasdb.com/atlas/files/public/67396d728970c2af4f5212b1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFCQUlBQUFBQUFBZ0FDQUZBQUFBQkFJQUFBQUFBQUlBQUFBQUFBQUNBQUFBRUFBQUJBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBRUFBSUFBQUFBQUFFQUFBQ0FBQUFBQkFBQUFBQUFBQVNBQUFBQUFBRUFBQUJBQUFFQUFBQUlBQWdDQUJBQUVJQUFBQUNBQVJBQUlBUkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1MDYsImV4cCI6MTc4MjMxOTMwNn0.2uQVnexkqhiRhuVAY0sK-XG6jKcxrCwATaPE_BU3FHk)

![](https://pingcode.yasdb.com/atlas/files/public/67396d73a1ad9a3311dc9121/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFCQUlBQUFBQUFBZ0FDQUZBQUFBQkFJQUFBQUFBQUlBQUFBQUFBQUNBQUFBRUFBQUJBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBRUFBSUFBQUFBQUFFQUFBQ0FBQUFBQkFBQUFBQUFBQVNBQUFBQUFBRUFBQUJBQUFFQUFBQUlBQWdDQUJBQUVJQUFBQUNBQVJBQUlBUkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1MDYsImV4cCI6MTc4MjMxOTMwNn0.2uQVnexkqhiRhuVAY0sK-XG6jKcxrCwATaPE_BU3FHk)

**example 2**

  


![](https://pingcode.yasdb.com/atlas/files/public/67396d73a1ad9a3311dc9122/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFCQUlBQUFBQUFBZ0FDQUZBQUFBQkFJQUFBQUFBQUlBQUFBQUFBQUNBQUFBRUFBQUJBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBRUFBSUFBQUFBQUFFQUFBQ0FBQUFBQkFBQUFBQUFBQVNBQUFBQUFBRUFBQUJBQUFFQUFBQUlBQWdDQUJBQUVJQUFBQUNBQVJBQUlBUkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1MDYsImV4cCI6MTc4MjMxOTMwNn0.2uQVnexkqhiRhuVAY0sK-XG6jKcxrCwATaPE_BU3FHk)

![](https://pingcode.yasdb.com/atlas/files/public/67396d73a1ad9a3311dc9123/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFCQUlBQUFBQUFBZ0FDQUZBQUFBQkFJQUFBQUFBQUlBQUFBQUFBQUNBQUFBRUFBQUJBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBRUFBSUFBQUFBQUFFQUFBQ0FBQUFBQkFBQUFBQUFBQVNBQUFBQUFBRUFBQUJBQUFFQUFBQUlBQWdDQUJBQUVJQUFBQUNBQVJBQUlBUkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1MDYsImV4cCI6MTc4MjMxOTMwNn0.2uQVnexkqhiRhuVAY0sK-XG6jKcxrCwATaPE_BU3FHk)

**注意技术点：**

1. 由于当前ctx只挂载了一个filters，但对于多个child的op来说，天然会需要挂载多个filters，因此设计会有冲突。
1. 因此特意抽出了一个childOpProcessor，并且将原来放在opProcessor的push逻辑，放到childOpProcessor处，再内部会通过特殊的处理，不断的覆盖ctx上的filters。
1. 原来的opProcessor则只做filter的拦截，即是对不能下推的filter做push stop filter。


![](https://pingcode.yasdb.com/atlas/files/public/67396d738970c2af4f5212b2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiSUFBQUFBQUFBQUFCQUlBQUFBQUFBZ0FDQUZBQUFBQkFJQUFBQUFBQUlBQUFBQUFBQUNBQUFBRUFBQUJBZ0FJQUFBQUFBQUFBQUFBQUFBQUFBQWdBQ0FBRUFBSUFBQUFBQUFFQUFBQ0FBQUFBQkFBQUFBQUFBQVNBQUFBQUFBRUFBQUJBQUFFQUFBQUlBQWdDQUJBQUVJQUFBQUNBQVJBQUlBUkFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDg1MDYsImV4cCI6MTc4MjMxOTMwNn0.2uQVnexkqhiRhuVAY0sK-XG6jKcxrCwATaPE_BU3FHk)

###   [4.4 特性性能点2](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)  

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=150625866&moved=true#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

[image2024-5-9_14-48-17.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzI4OTcwYzJhZjRmNTIxMmE3IiwicmVmX2lkIjoiNjczOTZkNzI1OTNmOTljOWZmMjM3YjViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NTA1LCJleHAiOjE3ODIzOTQ5MDV9.MrnN_6X8goVJ47DhVSa-4JBlj_LIqVSl8ULsc4M_EQg)

 (image/png)    


[image2024-5-9_11-53-11.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzI4OTcwYzJhZjRmNTIxMmE5IiwicmVmX2lkIjoiNjczOTZkNzI1OTNmOTljOWZmMjM3YjViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NTA1LCJleHAiOjE3ODIzOTQ5MDV9.nAKdZC4Rbs0JMgb0ymaXEcAFSjsnKTTnKyilcwT0IkQ)

 (image/png)    


[image2024-4-23_16-48-46.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzI4OTcwYzJhZjRmNTIxMmFhIiwicmVmX2lkIjoiNjczOTZkNzI1OTNmOTljOWZmMjM3YjViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NTA1LCJleHAiOjE3ODIzOTQ5MDV9.wcnIT2zUld7x4JOI1Z6Nc5W70Y_vi-3gOzYSmGkYnjg)

 (image/png)    


[image2024-4-23_16-17-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkNzI4OTcwYzJhZjRmNTIxMmFiIiwicmVmX2lkIjoiNjczOTZkNzI1OTNmOTljOWZmMjM3YjViIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA4NTA1LCJleHAiOjE3ODIzOTQ5MDV9.K5Jyl78k8o56Wq7UqkkaMzZ72YgiGmUsnInk5TR5cWo)

 (image/png)    
