Created by 陈秋富, last modified on 十月 14, 2024

*归档路径：*    [YDBRD-26130 Overlaps 特性开发设计文档 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=171054560)  

*详细设计-YDBRD-26130 : Overlaps Design（Overlaps 特性方案设计）*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b078](https://pingcode.yasdb.com/ship/ideas/660b743f009f91eb87f2b078)    *    #YASHAN-296 支持overlaps函数*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6618d27efd997db58ad80245](https://pingcode.yasdb.com/pjm/items/6618d27efd997db58ad80245)    * #YDBRD-26130 支持overlaps函数*

##   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-%E6%80%BB%E8%BF%B0)  

###   [1.1 需求来源](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

Overlaps功能的需求来自于国信证券--融选适配，主要的目的是需要判断两个时间段是否有重叠。

**特性支持的部署形态为 主备(单机)。**

###   [1.2 调研文档](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  [Overlaps 特性调研 - 陈秋富 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=150602494)  

Oracle的`OVERLAPS`函数是一个专门用于比较日期时间间隔的函数，它可以判断两个时间段是否有重叠。这个函数在处理日期和时间相关的查询时非常有用，尤其是在需要确定两个事件或时间段是否在同一时间点有交集的场景中。

`OVERLAPS`函数的基本语法如下：

![](https://conf.yasdb.com/download/attachments/150602494/image2024-4-9_9-38-20.png?version=1&modificationDate=1712626700000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFFQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcxNjcsImV4cCI6MTc4MjMxNzk2N30.e4TYBCEJZD6N3qCFC5TM0q9HbGCMMh3ks9LZDq76m0Y)

其中，`start_date1`和`end_date2`定义了第一个时间段的开始和结束时间，而`start_date2`和`end_date2`定义了第二个时间段的开始和结束时间。当两个时间段有重叠时，函数返回`TRUE`，否则返回`FALSE`。

###   [1.3 需求分析](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|新增Overlaps的filter type|见后续章节|是|是|
|周边配置|解析器|见后续章节|是|是|
|周边配合|优化器|----|----|是|
|周边配合|执行器|见后续章节|是|是|
|周边配合|列执行器|----|----|是|


###   [1.4 数据字典](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

无

###   [1.5 开源依赖](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-%E6%8E%A5%E5%8F%A3)  

**列出从SR层级对外可以感知的特性，对应提供的接口、配置参数、API等。**     SR对外呈现的接口，如一个SQL语法（含多个分支），一个高级包（含多个子函数、过程），SQL语法分支、函数功能、高级包功能、系统视图与动态视图（不包含用户自定义视图）、配置参数、驱动接口、用户可感知的错误码、告警、日志 等

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|SQL语法|![](https://conf.yasdb.com/download/attachments/150602494/image2024-4-9_9-38-20.png?version=1&modificationDate=1712626700000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFFQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcxNjcsImV4cCI6MTc4MjMxNzk2N30.e4TYBCEJZD6N3qCFC5TM0q9HbGCMMh3ks9LZDq76m0Y)|----|是|
|函数|返回bool类型，true或者false的结果。|----|是|
|高级包|高级包子对象描述|----|否|
|系统视图|视图域段描述|----|否|
|动态视图|视图域段描述|----|否|
|配置参数|配置参数作用、生效方式|----|否|
|驱动接口|驱动对外提供接口描述|----|否|
|错误码|错误码、ACTION描述|----|否|
|告警|告警描述|----|否|
|日志|日志触发条件、等级、事件描述|----|否|


##   [3. 规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- **overlaps前后表达式部分输入个数是2个，不可缺省。**
- **输入的参数类型为 DATE、TIMESTAMP、TIME类型，其他类型报错。**
- **四个表达式的类型一致，否则报错。**
- **返回类型为BOOL类型，输出结果为true或者false。**
- **由于目前null和空串''，都表示成null，所以空串''的报错不支持。**
- **overlaps单边的表达式列表不能全部为null，全部为null的时候会报错。**


##   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-%E7%89%B9%E6%80%A7)  

###   [4.1 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#41-%E7%89%B9%E6%80%A7%E8%AE%BE%E8%AE%A1)    parse阶段处理

（1）新增OVERLAPS关键字段，ANL_TOKEN_OVERLAPS，可以支持作为别名。

（2）新增处理函数 parseFilterOverlaps，读取word左右两边的字符，解析成EXPR_lIST的结果挂载在 FilterNode→cmp节点上。如下图所示。

![](https://pingcode.yasdb.com/atlas/files/public/67396d4ca1ad9a3311dc9055/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBSUFBQUFBQUFFQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBRUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDcxNjcsImV4cCI6MTc4MjMxNzk2N30.e4TYBCEJZD6N3qCFC5TM0q9HbGCMMh3ks9LZDq76m0Y)

```
关键字：ANL_TOKEN_OVERLAPS

static CodResult parseFilterOverlaps(AnlParser* parser, LangWord* word, FilterNode* node, Expr* left);
```

###   [4.2 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92)    verify/conclude阶段处理

（1）类型、数量拦截

- 四个表达式expr的类型需要相同。都为DATE、TIMESTAMP、TIME的时间日期类型。
- overlaps filter左边的list的expr数量为2，右边数量也为2。


（2）未知类型处理

- 需要先对四个表达式都进行遍历，只要其中一个有明确类型，其余未知unknown类型的表达式都往这个明确类型调整。否则全部unknown时，则调整成DATE类型.


```
新增FILTER枚举类型：FILTER_OVERLAPS

static CodResult verifyFilterOverlaps(AnlVerifier* vrfr, FilterNode* node);
CodResult concludeFilterOverlaps(AnlStmt* stmt, FilterNode* node);
```

###   [4.3 ](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#43-%E7%89%B9%E6%80%A7%E6%80%A7%E8%83%BD%E7%82%B91)    exec阶段处理

（1）先确定好每个区间的起始和终止日期点。

（2）在有序的情况下，只需要包装 start_date1 < end_date2 并且 start_date2 < end_date1情况下，则认为两个区间有交集。

（3）对于null的处理，一个区间内的首尾都为null时候，返回结果false。不报错（此处和oracle不同。），其余情况相同。

```
static CodResult execFilterOverlaps(AnlStmt* stmt, FilterNode* node, FilterResult* filterResult)
```

##   [5. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

- overlaps作为别名的情况，尤其是在plsql内部作为udf出现的时候。
- 表达式部分出现空值 null 或者 空串 或者缺省
- 边界范围
- 输入类型验证
- 绑定参数
- 出现在group by等位置，是否能整体引用上等。
- overlaps可出现的位置。如投影列、group by、where等
- filter条件组合
- bool表达式场景 以及check约束场景。


##   [6.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

说明本方案遗留待解决的问题、下一步需要解决的问题或者未来演进规划。

## Attachments:

## Comments:

|  [](null)  ,overlaps函数开发设计评审会议：,主持人：陈秋富,与会人：陈秋富、韩晓盼、胡晓畔、罗继鸿、林博,地点：26栋702,时间：2024年4月16日 16:00 ~ 17:00,会议意见：,1、规格约束中的全null情况，oracle报错，这块考虑不报错是否合适？,2、自测部分可以考虑新增测试点：（1）bool表达式（2）check约束。,3、交付形态上，是否只支持单机。,Posted by chenqiufu at 四月 16, 2024 16:31|
|---|
