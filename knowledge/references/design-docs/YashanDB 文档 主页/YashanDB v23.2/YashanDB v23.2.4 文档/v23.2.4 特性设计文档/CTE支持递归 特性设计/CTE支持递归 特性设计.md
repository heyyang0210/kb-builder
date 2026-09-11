Created by 陈秋富, last modified on 七月 19, 2024

归档路径：    [CTE支持递归 特性设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159435871)  

  


*详细设计-YDBRD-26114 : Recursive CTE Design（CTE支持递归 方案设计）*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b30c](https://pingcode.yasdb.com/ship/ideas/660b7442009f91eb87f2b30c)    *? #YASHAN-956 CTE支持递归功能*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6618aacffd997db58ad7e8d9](https://pingcode.yasdb.com/pjm/items/6618aacffd997db58ad7e8d9)    *?#YDBRD-26114 CTE支持递归功能*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

成熟模块的特性，概要设计和详细设计合一，必须说明本设计方案的需求来源，需求分析，功能概要描述。  **此类型设计文档要给出IR到SR拆分的依据。**

关键特性的SR设计，总述可以链接IR的概要设计文档，此处开始主要讲对应SR特性的需求范围。

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

递归查询是CTE（Common Table Expressions，公共表表达式）的一个特性，它允许用户执行递归操作，从而可以查询具有层次结构的数据。yasdb数据库已经实现了普通CTE（WITH的语法）的流程，需要补全递归CTE的功能。

**支持的部署形态为 主备(单机)、集群。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

**调研文档：**    [CTE支持递归 特性调研 - 陈秋富 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156110441)  

**友商情况：**

  [MySQL :: MySQL 8.0 Reference Manual :: 15.2.20 WITH (Common Table Expressions)](https://dev.mysql.com/doc/refman/8.0/en/with.html#common-table-expressions-recursive)  

  [SELECT (oracle.com)](https://docs.oracle.com/en/database/oracle/oracle-database/21/sqlrf/SELECT.html#GUID-CFA006CA-6FF1-4972-821E-6996142A51C6__I2077142)  

  [WITH common_table_expression (Transact-SQL) - SQL Server | Microsoft Learn](https://learn.microsoft.com/en-us/sql/t-sql/queries/with-common-table-expression-transact-sql?view=sql-server-ver16#guidelines-for-defining-and-using-recursive-common-table-expressions)  

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能1|递归CTE语法解析|  
|是|是|
|功能2|递归CTE执行|  
|是|是|
|功能3|递归CTE计划|  
|是|是|
|性能|性能场景1|该场景下关键性能指标通过什么方案满足|否|否|
|可用性|恢复场景|----|否|否|
|可靠性|故障场景|----|否|否|
|可维可测|DFX功能1|----|否|否|
|安全|安全场景1|----|否|否|
|易用性|----|----|否|否|
|可修改性|----|----|否|否|
|兼容性|----|----|否|否|
|周边配合|权限|----|否|否|
|周边配合|审计|----|否|否|
|周边配合|导入导出工具|----|否|否|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

**描述本篇文档中特性的术语集**

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|CTE|Common Table Expressions，公共表表达式|是|无|
|anchor_query|CTE中的锚定子查询，递归子查询的起点|是|无|
|recursive_query|CTE中的递归查询主体|是|无|
|BFS|BFS 全称是     [Breadth First Search](https://en.wikipedia.org/wiki/Breadth-first_search)    ，称做广度优先搜索。每次都尝试访问同一层的节点。 如果同一层都访问完了，再访问下一层|是|无|
|DFS|DFS 全称是     [Dreath First Search](https://en.wikipedia.org/wiki/Breadth-first_search)    ，称做深度优先搜索。是一种用于遍历或搜索    [树](https://en.wikipedia.org/wiki/Tree_data_structure)    或    [图形](https://en.wikipedia.org/wiki/Graph_(data_structure))    数据结构的    [算法](https://en.wikipedia.org/wiki/Algorithm)    。该算法从    [根节点](https://en.wikipedia.org/wiki/Tree_(data_structure)#Terminology)    开始（在图形的情况下选择某个任意节点作为根节点），并在回溯之前尽可能沿着每个分支进行探索。|是|无|


###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|  [SELECT | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html)  ,属于   **QUERY **  中的   **with_clause**   部分|----|是|
|SQL语法|![](https://conf.yasdb.com/download/attachments/156110441/image2024-6-5_15-39-23.png?version=1&modificationDate=1717573164000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQURBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQkFBQUFBQkFBQUFBQUFFQVlBQUFBQUFBQUFBQUFBQUFBQUFBQkFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBR0FBQUFBQkFBQ0FBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA5OTMsImV4cCI6MTc4MjMyMTc5M30.MVNsJ47TsaNtwRBOyVsuCZ8v3xvOx8ybyXkzGoUUKeo)|----|是|
|执行|新增物化结构，实现BFS算法搜索路径。存储每轮递归查询出来的结果集。|----|是|
|cbo计划|新增算子 RECURSIVE WITH PUMP算子，用于获取前次递归查询结果。|----|是|
|错误码|新增递归CTE相关的报错信息,错误码： ERR_ANS_EXEC_RECURSIVE_LOOP,报错信息：YAS-04470 recursive query with loop, the max recursion depth is %u|----|是|
|配置参数|MAX_RECURSION_DEPTH,该参数用于控制递归CTE执行遍历的深度。默认值为1000。,基于session级别生效。也可配置成全局生效。|----|是|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

**语法方面：**

1. **recursive_query部分不可以单独存在。（引用本身CTE定义的时候就会被认为是递归CTE子句，即recursive_query）**
1. 单anchor_query时候会退化回既有的CTE功能。(    [Common Table Expression - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/display/YAS/Common+Table+Expression)    )
1. 两个query之间连接符号需为  **UNION ALL**  ，其他集合操作类型则报错。且只能连接两个query分支，连接的左右query分支可以调转顺序。
1. anchor_query和recursive_query的投影列  **数量和CTE定义一致**  、cte定义的投影列语法和column类似，都是  **默认按大写存放**  。   **anchor_query和CTE部分的投影列名称没有必然联系**  ，可以不一致。
1. recursive_query中只能引用自身CTE一次。引用多次则报错。
1. recursive_query中特殊场景的限制（不支持）：带distinct、带group、  aggr function、部分win function（当前yasdb内的窗口函数都支持     [内置函数 | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/22.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0/00%E5%86%85%E7%BD%AE%E5%87%BD%E6%95%B0.html#%E7%AA%97%E5%8F%A3%E5%87%BD%E6%95%B0-window-function)    ）、带自身CTE的子查询、connect by、pivot、having、for update
1. cte部分在join条件下，作为左右表并无区别，  **但是outer join下只能作为join的左表（非补空侧）。**
1. **先实现缺省的递归CTE，search_clause和cycle_clause语法未实现。**


**执行情况：**

1. 当查询递归的层数超过配置参数   **MAX_RECURSION_DEPTH **  设置的上限值时，会报错。无主动识别嵌套死循环的能力。
1. 同层可以返回相同的数据集。
1. 对于执行过程中存在非稳态函数，递归执行过程中是执行多次。如random函数
1. 不排序的情况下，按  **深度优先遍历（BFS）**  的图搜索算法结果输出。


**with子句功能的阐述：(同原本规格**    [SELECT | YashanDB Doc (yasdb.com)](https://cod-doc.yasdb.com/yashandb/23.2/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/SELECT.html#withclause)    **)**

1. WITH后面需要跟关键SELECT，不能带UPDATE、DELETE等。
1. WITH子句可以当作subquery的形式存在。
1. create table/view + with 
1. explain + with


**支持场景：**

单机、集群

**窗口函数支持情况**  ：

- 当前支持：LISTAGG、MAX、MIN、MEDIAN、AVG、COUNT、SUM、LEAD、LAG、FIRST_VALUE、LAST_VALUE、DENSE_RANK、RANK、ROW_NUMBER
- 不支持：  percentile_cont、  ~~（NTH_VALUE、PERCENT_RANK未实现）~~


**配置参数：**

- 新增配置参数   **MAX_RECURSION_DEPTH**  ，默认值为1000。
- 基于session级别生效。也可配置成全局生效。


**差异项：**

1. order by、limit offset 限制情况和oracle不一致。
1. 新增递归深度配置项参数，而oracle不支持。


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    cte结构设计

- 新增isRecursive标记，用于判断cte属于递归CTE。
- cte全局唯一标识，通过 ctxId、id在parseTree的数组中定位到该唯一的cte。
- cte结构如下


```
typedef struct StCommonTableExpr {
    CodUint32     id;
    CodUint32     ctxId;
    CodText       name;
    CodTextPos    namePos;
    CodTextPos    columnPos;
    List*         columnNames;
    QueryContext* query;

    CodBool  isRecursive;
    CodBool  isCopied;
    CodUint8 unused[6];
} CommonTableExpr;
```

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    parse阶段设计

1、复用原本的parseCte的流程。

将CTE内容解析成  **CommonTableExpr**  结构，并且挂载在  **parseTree->cteContexts**  链表上。同原本的流程相同。

2、递归cte的识别：

通过parser上下文，挂载当前所处的cte信息（包括ctxId, id）。在访问路径上  **anlFindCte**  函数中遇到相同标识cte时，将cte挂上  **isRecursive**  的标记。

3、通过识别到isRecursive的位置，往上将路径上的queryNode也打上   **isRecursiveQuery**  的标识，用于标识成递归cte结构中的 recursiveQuery部分。

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    verify阶段

1、对于递归cte的拦截：

在verifer上下中挂上当前所处cte信息（vrfr->currCte），首次访问的时候，需要同步校验cte->subquery部分。再次遇到时候（判断vrfr→currCte和currCte），则直接返回。

2、新增SCNR_FLAG_RECURSIVE场景标识，用于对于部分语法场景的限制和拦截。

###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    cbo计划部分

递归cte算子的表示：

1、复用union all算子，在识别到递归cte时候，打上isRecursive的标识到对应plan算子上面。

2、复用view算子和result算子，用于表示oracle中的pump算子。

###   [4.4 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#44-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B92)    执行部分

### 4.4.1 物化区的准备

- 新增物化区表示 EXEC_RES_RECURSIVE_CTE
- 物化区结构


```
typedef struct StRcursiveContext {
    MatId     mqDataInId;  
    MatId     mqDataOutId;
    CodUint32 putCount;
    CodUint32 scanCount;
    CodUint32 recursiveDepth;
    CodUint8  reserved[4];
} RcursiveContext;
```

- 物化区执行逻辑 采用MAT_QUEUE的队列结构。存入数据时候使用 mqDatatInId的物化区，取出数据的时候，使用mqDataOutId的物化。
- 流程如下：    

- ![](https://pingcode.yasdb.com/atlas/files/public/67396db58970c2af4f5214b8/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQURBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQkFBQUFBQkFBQUFBQUFFQVlBQUFBQUFBQUFBQUFBQUFBQUFBQkFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBR0FBQUFBQkFBQ0FBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA5OTMsImV4cCI6MTc4MjMyMTc5M30.MVNsJ47TsaNtwRBOyVsuCZ8v3xvOx8ybyXkzGoUUKeo)


### 4.4.2 算法逻辑考虑

![](https://pingcode.yasdb.com/atlas/files/public/67396db5a1ad9a3311dc932b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQURBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQkFBQUFBQkFBQUFBQUFFQVlBQUFBQUFBQUFBQUFBQUFBQUFBQkFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBR0FBQUFBQkFBQ0FBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA5OTMsImV4cCI6MTc4MjMyMTc5M30.MVNsJ47TsaNtwRBOyVsuCZ8v3xvOx8ybyXkzGoUUKeo)

算法考虑：

1、针对于DFS搜索路径

考虑每层数据采用stack去暂存，每次取stack中的一行数据，去产生下一层的一批数据。直至最后一层。  退回上层后，再取当前层的下一个数据。  （死循环则是记录这个路径上的data是否visit过）

![](https://pingcode.yasdb.com/atlas/files/public/67396db58970c2af4f5214b9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQURBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQkFBQUFBQkFBQUFBQUFFQVlBQUFBQUFBQUFBQUFBQUFBQUFBQkFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBR0FBQUFBQkFBQ0FBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA5OTMsImV4cCI6MTc4MjMyMTc5M30.MVNsJ47TsaNtwRBOyVsuCZ8v3xvOx8ybyXkzGoUUKeo)

2、针对于BFS搜索路径

采用BFS+图信息的方式。 每层产生的下一层数据，构造图中的边。 维护节点 m→n 的信息。 每次加入新的节点的时候，都需要新增对应新的边的信息。（死循环检测 则是判断 边的集合中是否 存在 n→m的边， 这块最多是维护 n*(n-1)/2 的边的个数  n是动态增加上来的。） 

![](https://pingcode.yasdb.com/atlas/files/public/67396db58970c2af4f5214ba/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQURBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQkFBQUFBQkFBQUFBQUFFQVlBQUFBQUFBQUFBQUFBQUFBQUFBQkFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBR0FBQUFBQkFBQ0FBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA5OTMsImV4cCI6MTc4MjMyMTc5M30.MVNsJ47TsaNtwRBOyVsuCZ8v3xvOx8ybyXkzGoUUKeo)

3、不主动去识别是否出现死循环，新增配置参数，限制最大访问层数。当递归访问到上限层数的时候，被动报错退出提醒。

**目前采用的是方案3的方式。**

### 4.4.3 执行流程

递归cte的执行逻辑图如下

![](https://conf.yasdb.com/download/attachments/156110441/image2024-6-11_10-1-27.png?version=1&modificationDate=1718071288000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQURBQUFBQUFJQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUFBQkFBQUFBQkFBQUFBQUFFQVlBQUFBQUFBQUFBQUFBQUFBQUFBQkFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBR0FBQUFBQkFBQ0FBQUFBQUFBUUFBQUFBQUFBQWdBQUFBQUFBQ0FBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTA5OTMsImV4cCI6MTc4MjMyMTc5M30.MVNsJ47TsaNtwRBOyVsuCZ8v3xvOx8ybyXkzGoUUKeo)

1、伪代码表示

```
UNION ALL(RECURSIVE)
    anchor_query exec 
    while(!anchor_query isEof) {
        put to mat
        fetch anchor_query
    }
	update data offset flag

    while(!mat is eof) {
        recursive_query exec
        while(!anchor_query isEof) {
            put to mat
            if(infinite loop) {
                set error;
                return;
            }
            fetch recursive_query
        }
		update data offset flag
    }
```

2、复用UNION_ALL算子，在此算子准备上述的物化区资源。union_all算子吐出的投影列数据放入到  **物化区in中**  。（见4.4.1章节）

3、复用view或者resulte算子，在此算子上访问  **物化区out**  数据。（见4.4.1章节）

4、采用  **MAT_QUEUE**  的物化区结构。

5、采用4.4.2章节中的方案3。  **当递归深度超过最大限制的时候，报错退出**  。不考虑主动发现死循环的逻辑。

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

- 语法组成方面 包括关键字、cte定义的投影列个数、query顺序等。
- 规格中提及的语法限制方面，分成两块，一块是anchor_query部分，一块是recursive_query部分。
- 执行方面，死循环报错。输出结果集的正确性。或者同层query返回多个相同的结果集。
- 递归深度应该是无上限的。
- 场景问题：1、每次需要等底层物化好，上层再进行取row的动作是否有问题？如并发px算子、aggr、join。 2、verify阶段 改完然后继续两次verify操作的场景是否有问题？如udt的。
- 数据中返回null的场景，出现在循环条件上，以及结束条件上面。
- 考虑udt出现隐藏列的场景。


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

1、需要修改cte位于query中的层级关系。 原本是通过select串接起来。现在要挂到query上。

## Attachments:

[recursive_cte.ebnf](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjRhMWFkOWEzMzExZGM5MzIxIiwicmVmX2lkIjoiNjczOTZkYjQ1OTNmOTljOWZmMjM3ZWIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwOTkzLCJleHAiOjE3ODIzOTczOTN9.tSTXooEP48_x63ya-emr-IsnFn1N3WZlVxcsvYDG-cM)

 (application/octet-stream)    


[image2024-6-28_9-47-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjRhMWFkOWEzMzExZGM5MzIzIiwicmVmX2lkIjoiNjczOTZkYjQ1OTNmOTljOWZmMjM3ZWIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwOTkzLCJleHAiOjE3ODIzOTczOTN9.F0oa6J8BxvMrjlQPrBmVr8cyOs9-lwvPMCbFT28Hgds)

 (image/png)    


[image2024-6-28_9-58-47.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjRhMWFkOWEzMzExZGM5MzI0IiwicmVmX2lkIjoiNjczOTZkYjQ1OTNmOTljOWZmMjM3ZWIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwOTkzLCJleHAiOjE3ODIzOTczOTN9.GG_1U6j2iJd_YLfC_IJseQyx0hKT_nRs2wHw_GLztJQ)

 (image/png)    


[image2024-6-28_9-59-57.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjQ4OTcwYzJhZjRmNTIxNGIxIiwicmVmX2lkIjoiNjczOTZkYjQ1OTNmOTljOWZmMjM3ZWIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwOTkzLCJleHAiOjE3ODIzOTczOTN9.JAoWNzhdP2tPVzPC2lf5X1sjbt8KVPdKF0FGpVBrJ0Q)

 (image/png)    


[image2024-6-28_10-1-22.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjQ4OTcwYzJhZjRmNTIxNGIyIiwicmVmX2lkIjoiNjczOTZkYjQ1OTNmOTljOWZmMjM3ZWIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwOTkzLCJleHAiOjE3ODIzOTczOTN9.ml7e23PSFJZnjt-srR2dd5ZdIUddQ1x6JO3JurDVC2o)

 (image/png)    


[image2024-6-28_10-17-49.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjQ4OTcwYzJhZjRmNTIxNGIzIiwicmVmX2lkIjoiNjczOTZkYjQ1OTNmOTljOWZmMjM3ZWIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwOTkzLCJleHAiOjE3ODIzOTczOTN9.fDsKCrLLxTtoQjFH_XqeyWuKbYn_sf8FJppP8GyPUS4)

 (image/png)    


[image2024-6-28_10-28-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjRhMWFkOWEzMzExZGM5MzI1IiwicmVmX2lkIjoiNjczOTZkYjQ1OTNmOTljOWZmMjM3ZWIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwOTkzLCJleHAiOjE3ODIzOTczOTN9.N5z9TeK-Gf3uGv8fqWPU8rFwccoa2ID-ntg_bK9Stfo)

 (image/png)    


[image2024-6-28_10-29-28.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjRhMWFkOWEzMzExZGM5MzI2IiwicmVmX2lkIjoiNjczOTZkYjQ1OTNmOTljOWZmMjM3ZWIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwOTkzLCJleHAiOjE3ODIzOTczOTN9.oi50EQhocC62IYAvAz3NcOhQD5L1-RhniNnUso4Z6dY)

 (image/png)    


[image2024-6-28_10-31-53.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjRhMWFkOWEzMzExZGM5MzI3IiwicmVmX2lkIjoiNjczOTZkYjQ1OTNmOTljOWZmMjM3ZWIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwOTkzLCJleHAiOjE3ODIzOTczOTN9.oYYH0e0WHIVId2VbStJXil577tGqIKzHtOvNciIZRcI)

 (image/png)    


[image2024-7-19_10-14-14.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkYjRhMWFkOWEzMzExZGM5MzI5IiwicmVmX2lkIjoiNjczOTZkYjQ1OTNmOTljOWZmMjM3ZWIzIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEwOTkzLCJleHAiOjE3ODIzOTczOTN9.h4F8UW8pfKRcucFfUZHH_ZGOdWM2vvNGIeWR8as64T0)

 (image/png)    


## Comments:

|  [](null)  ,时间：2024-06-24 17:00~18:00,主题：支持递归CTE 开发评审,地点：红山25座702,主持人：陈秋富,与会人：陈秋富、罗继鸿、徐晓锋、徐伟、陈敬厅、马文英、许秋莹,意见：,1、recursive_query展开其语法图    
  2、语法上with嵌套with情况，oracle不支持，yasdb支持。    
  3、递归终止条件。    
  4、oracle with语法上还带有 search_clause 和 cycle_clause 语法，考虑是否要做。    
  5、从终止条件还是数据集上判断死循环。 部分情况可以从filter条件上提前判断出来。    
  6、白名单设置win function支持情况，防止后续新增win_function不支持得情况。    
  7、table function里头带cte、外部表如dblink的表现。是否需要禁用掉。    
  8、verify cte根据anchor_query的rsColumn决定。 估计是天然union all的时候支持的。    
  9、recursive_query中join表个数、顺序是否对递归结果有影响。尤其是算法层面。    
  10、考虑是否新增两个算子。PUMP + UNION ALL RECURSIVE。,Posted by chenqiufu at 六月 25, 2024 09:12|
|---|
