Created by 韩晓盼, last modified on 七月 19, 2024

IR：    [https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf3f](https://pingcode.yasdb.com/ship/ideas/660b7480009f91eb87f2bf3f)    ?    
  #YASHAN-1075 Filter补充，null与not null的补充，连接列min与max的补充

SR：    [https://pingcode.yasdb.com/pjm/items/66263271fd997db58adefa43](https://pingcode.yasdb.com/pjm/items/66263271fd997db58adefa43)    ?    
  #YDBRD-26581 Filter补充，null与not null的补充，连接列min与max的补充

# 1.   **概述**

本需求设计范围是Filter补充，null与not null的补充，连接列min与max的补充  。目的是  用于生成更多的过滤条件，从而可能提前减少数据集。这里扩充的过滤条件是这2种：

1）is not null

2）cmp（链接列min和max的补充）

扩展之后的FilterNode属于 optional filter，  根据selectivity值判断是否使用该扩展条件。

# 2.   **需求分析**

**1、谓词扩展**

（1）功能与性能方案

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|:---|:---|:---|:---|:---|
|功能|根据expr扩展|根据expr生成扩展FilterNode。|是|是|
|  
|根据FilterNode扩展|1、同一个查询块之间的传递，比如在projection算子生成的optional filter，最终传递给scan。    
  2、不同查询块之间的传递，比如将外部的is not null传递给viewscan。|是|是|
|  
|调整已有filter为optional filter|比如原始语句：t1.c1= t2.c1 and t1.c1 is not null，可以将t2.c1 is not null放入optional filter。|是|是|
|  
|optional FilterNode的选择|根据选择率进行选择。|是|是|
|  
|在sTrans中的谓词扩展|1、将上一层的扩展信息拷贝下来。    
  2、在当前算子中进行扩展。|是|是|
|性能|下推后性能|多扩展出的谓词提前过滤表数据|是|是|


（2）规格与限制

- 暂不支持用户自定义汇聚函数（udf？）
- is not null被选用的条件设定为：selectivity < 0.3(会话级参数)
- 目前扩展的类型为：is not null、 >=min、<=max


注：_OPT_FILTER_THRESHOLD（会话级参数），当扩展出来的谓词对应的  **selectivity<_OPT_FILTER_THRESHOLD**  时，表明该谓词备选。

  `select`         `* `      `from`         `v$parameter `      `where`         `name`         `like`         `'_OPT_FILTER_THRESHOLD'`      `;`      
    `alter`         `session `      `set`         `_OPT_FILTER_THRESHOLD=0.3;`  

  


**2、需求来源**

需求来源：    
  tpcds    
    
  场 景：    
  1、Filter补充，null与not null的补充，连接列min与max的补充    
    
  需求描述：    
  1、支持Filter补充，null与not null的补充，连接列min与max的补充，过滤性好的时候，稀疏索引优势较大：Q1    
    
  需求范围：    
  1、单机?、分布式和集群?    
  2、行表?、列表

  


**3、特性分析**

根据第2节1.1，进行实际扩展。

**3.1 根据expr扩展**

支持bif aggr函数谓词扩展，扩展方式如下表。

|  
|语法|扩展方式|
|---|---|---|
|AGGR_COUNT |COUNT "(" ("*"|([DISTINCT|ALL] expr)) ")|count([distinct ]c1) => c1 is not null|
|AGGR_SUM|SUM "(" [DISTINCT|ALL] expr ")"|sum(c1) => c1 is not null |
|AGGR_AVERAGE|AVG "(" [DISTINCT|ALL] expr ")"|avg([distinct] c1) => c1 is not null |
|AGGR_MIN|MIN "(" [DISTINCT|ALL] expr ")"|min(c1) => c1>= min(c1)         |
|AGGR_MAX|MAX "(" [DISTINCT|ALL] expr ")"|max(c1) => c1 <= max(c1)   |
|AGGR_STDDEV_POP|STDDEV_POP "(" expr ")"|STDDEV_POP(C1) => c1 is not null|
|AGGR_VAR_POP|VAR_POP "(" expr ")"|VAR_POP(C1) => c1 is not null|
|AGGR_STDDEV|STDDEV "(" [DISTINCT|ALL] expr ")"|STDDEV([distinct] c1) => c1 is not null|
|AGGR_VARIANCE|VARIANCE "(" [DISTINCT|ALL] expr ")"|VARIANCE ([distinct] c1) => c1 is not null|
|AGGR_STDDEV_SAMP|STDDEV_SAMP "(" expr ")"|STDDEV_SAMP (c1) => c1 is not null|
|AGGR_VAR_SAMP|VAR_SAMP "(" expr ")"|VAR_SAMP(c1) => c1 is not null|
|AGGR_GROUPING|GROUPING"(" expr ")"|GROUPING(c1) => c1 is not null|
|AGGR_GROUPING_ID|GROUPING_ID"(" expr ",……)"|GROUPING_ID(c1) => c1 is not null|


**3.2 根据FilterNode扩展**

|类型|扩展方式|函数|
|---|---|---|
|FILTER_EQUAL|1、c1  cmp c2 : left is not null and right is not null    
  2、c1 cmp const：不扩展|extFilterCmp|
|FILTER_NOT_EQUAL||extFilterCmp|
|FILTER_GREAT||extFilterCmp|
|FILTER_GREAT_EQUAL||extFilterCmp|
|FILTER_LESS||extFilterCmp|
|FILTER_LESS_EQUAL||extFilterCmp|
|FILTER_LIKE|1）column like const%: left is not null, left is greater min left is less than max    
  2）column like %const : left is not null    
  3）column like column /expr （expr包含column）: left is not null, right expr is not null|extFilterLike|
|FILTER_NOT_LIKE|同上|extFilterLike|
|FILTER_RLIKE|1）column rlike column/expr（expr包含column） : left is not null, right expr is not null    
  2）coumn  rike  其他：left is not null |extFilterLike|
|FILTER_NOT_RLIKE|同上|extFilterLike|
|FILTER_BETWEEN|已经不存在between的情况需要优化|/|
|FILTER_IS_NULL|/|/|
|FILTER_IS_NOT_NULL|/|/|
|FILTER_BOOL|备注：需要能扩展出来，todo|extFilterBool|
|FILTER_ANY|单列：    
  1）column cmp any(subquery): left is not null    
  2)  column cmp any (const list): left is not null    
  3)  column cmp any(column list):  left is not null  and (col1 is not null or col2 is not null or coln is not null)    
  4)  colun cmp any(mix const and col):  left is not null    
    
,多列：（不支持）    
  1）（col1 and col2 ……） cmp any (）：col1 is not null and col2 is not null|extFilterAny|
|FILTER_SOME？|  
|  
|
|FILTER_ALL|单列：    
  1）column cmp all(column) : left is not null and (col1 is not null and coln is not null)    
  2)  column cmp all(const list) : left is not null    
  3)  column cmp all(nix const and col): left is not null    
  4)  column cmp all(subquery): 不能扩展    
    
  多列：（不支持）    
  1、（col1 and col2 ……） cmp all (）：col1 is not null and col2 is not null|extFilterAll|
|FILTER_EXISTS|  
|extFilterExists|
|FILTER_NOT_EXISTS|  
|extFilterExists|
|FILTER_IN|单列：,1、col in const list: left is not null, left is greater than min, left is less than max.    
  2、col in column list: left is not null and (col1 is not null or col2 is not null or coln is not null)    
  3、col in mix / const and col. left is not null    
  4、col in subquery: left is not null, (subquery projection is not null),  
,多列：    
  1、（col1 and col2 ……） in (非子查询）：col1 is not null and col2 is not null    
  1、（col1 and col2 ……） in (subquery）： left is not null, (subquery projection is not null)|extFilterIn|
|FILTER_NOT_IN|单列：    
  1）column not  in (subquery):  不能扩展    
  2)  column not in  (const list): left is not null    
  3)  column not in (column list):  left is not null  and (col1 is not null and col2 is not null and coln is not null)    
  4)  colun not in (mix const and col):  left is not null    
    
,多列：    
  1）（col1 and col2 ……） not in  (非子查询）：col1 is not null and col2 is not null    
  2）（col1 and col2 ……） not in  (subquery）：不能扩展|extFilterNotIn|


**3.3 调整已有filter为optional filter**

如果查询语句中，本身的自带的is not null已经被其他其他覆盖，则可以去掉。

```
select * from t1 where c1>6 and c1 is not null;
```

对于这条查询语句，等价于：

```
select * from t1 where c1>6;
```

**3.4 optional FilterNode的选择**

1）如果查询语句中，本身的自带的is not null已经被其他其他覆盖，则可以去掉。

2）对于扩展出来的is not null，可以被覆盖（比如col cmp），则去掉该is not null。

3）在进行pick时，有多个is not null符合，则选择selectivity最小的那个，并添加到filters。其他的被扩展的is not null不采用。

备注：对于选择率，有函数对于类型、选择率进行了排序。todo

  


**3.5 在sTrans中的谓词扩展**

目前算子的谓词扩展逻辑。

|算子|trans函数|
|---|---|
|OP_LOGICAL_SELECT|sTransSelect|
|OP_LOGICAL_UPDATE|/(表示sTransPassThru)|
|OP_LOGICAL_DELETE|/|
|OP_LOGICAL_INSERT|/|
|OP_LOGICAL_MERGE|/|
|OP_LOGICAL_SCAN|sTransScan|
|OP_LOGICAL_IDXSCAN|/|
|OP_LOGICAL_JOIN|sTransJoin|
|OP_LOGICAL_GROUP|sTransGroup|
|OP_LOGICAL_DISTINCT|/|
|OP_LOGICAL_AGGR|sTransAggr|
|OP_LOGICAL_WINFUNC|/|
|OP_LOGICAL_LIMIT|sTransLimit|
|OP_LOGICAL_FOR_UPDATE|/|
|OP_LOGICAL_CONNECT_BY|/|
|OP_LOGICAL_UNION|/|
|OP_LOGICAL_UNIONALL|/|
|OP_LOGICAL_MINUS|/|
|OP_LOGICAL_MINUS_ALL|/|
|OP_LOGICAL_INTERSECT|/|
|OP_LOGICAL_INTERSECT_ALL|/|
|OP_LOGICAL_VIEWSCAN|sTransViewScan|
|OP_LOGICAL_RESULT|sTransResult|
|OP_LOGICAL_PROJECT|sTransProject|
|OP_LOGICAL_COUNT|sTransCount|
|OP_LOGICAL_FIRSTROW|/|
|OP_LOGICAL_SORTAGGRDIST|/|
|OP_LOGICAL_ACSCAN|/|
|OP_LOGICAL_EXPAND|/|
|OP_LOGICAL_TABLE_FUNC_SCAN|/|
|OP_LOGICAL_JOINGRAPH|/|
|OP_LOGICAL_WINPART|/|


参考：    [谓词扩展 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156111392)  

# 3.   **测试设计方法**

使用边界值，等价类，场景分析等测试方法。

如函数值测试中使用了边界值测试，非法入参类型测试使用了等价类测试，函数位置测试使用了场景分析法。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点，可沿用xmind的方式

![](https://pingcode.yasdb.com/atlas/files/public/67396de3a1ad9a3311dc941a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFnQUFBZ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMTI4OTMsImV4cCI6MTc4MjMyMzY5M30.ruN3lf5uXUPE0i0BnYezwfG4cj3NDBnzKJ2ok2Ug1Ps)

2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


附件：

[YDBRD-26581 filter补充测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTI4OTcwYzJhZjRmNTIxNWEwIiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.TIWOUqiKkHwyVjwyT6ixVrctpskgn1_Y9W1g1DHri58)

# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

[image2024-4-16_17-37-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTJhMWFkOWEzMzExZGM5NDE1IiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.UmvBEdYkpQpGYyRSRC7m-elTAPBmMuhMpt26011iFvQ)

 (image/png)    


[image2024-4-16_17-43-19.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTI4OTcwYzJhZjRmNTIxNWExIiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.IxI7wlKyl9Z0lUyEptppz9KYV0ZHaQj1pU-KczTwmz0)

 (image/png)    


[image2024-4-16_17-44-37.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTJhMWFkOWEzMzExZGM5NDE2IiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.KjH6WU-teunYQmnIMwIwzipp7YIYwSiZ4YIrYj6YCds)

 (image/png)    


[image2024-4-16_17-52-44.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTJhMWFkOWEzMzExZGM5NDE3IiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.5wBsSfhIF5nclM6rxvJxzqRwu3wbrAsoUOquUr9740M)

 (image/png)    


[image2024-5-14_14-28-58.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTJhMWFkOWEzMzExZGM5NDE4IiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.ZmTGqrJE10_C117d1nOr96xhjhWDqmE2LEqE4BZUZBU)

 (image/png)    


[image2024-7-12_12-4-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTI4OTcwYzJhZjRmNTIxNWEyIiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.YSYbIWv3IjKj_f02oukvDB0xI0XGf7eAD2Oe3e4eAr0)

 (image/png)    


[YDBRD-26581 filter补充测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTJhMWFkOWEzMzExZGM5NDE5IiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.-khOt83ncuQ4Dq38bSAeurZbPw2HATp6UdFHPXb5AAo)

 (application/x-xmind)    


[image2024-7-15_11-35-40.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTI4OTcwYzJhZjRmNTIxNWEzIiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.Ii09sZd2kJfF0-jNMX7VuZ-QBOWqpyQuV40SoUih8wE)

 (image/png)    


[YDBRD-26581 filter补充测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTI4OTcwYzJhZjRmNTIxNWE0IiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.5PA5-xj8ttpvSpSNKuZGo7Hi_PGmX7Vu-Kw1i_rNBDs)

 (application/x-xmind)    


[YDBRD-26581 filter补充测试设计.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZTI4OTcwYzJhZjRmNTIxNWEwIiwicmVmX2lkIjoiNjczOTZkZTI1OTNmOTljOWZmMjM4MGIyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyODkzLCJleHAiOjE3ODIzOTkyOTN9.TIWOUqiKkHwyVjwyT6ixVrctpskgn1_Y9W1g1DHri58)

 (application/x-xmind)    
