Created by 钟金健 on 五月 23, 2024

*YDBRD-26135 Median Design*

  


*详细设计-YDBRD-26135*  * *  *: percentile_cont Design（percentile_cont 方案设计）*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/6618d418fd997db58ad804d6](https://pingcode.yasdb.com/pjm/items/6618d418fd997db58ad804d6)    *?*    
  *#YDBRD-26135 支持MEDIAN函数，用于非窗口函数计算*

##   [1. 总述](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#1-%E6%80%BB%E8%BF%B0)  

本SR目标是yasdb内核支持median函数聚合函数功能部分。（窗口函数的功能已经支持）

median函数作用：返回组内参数的中位数。

交付范围：

- 存储方式：行存
- 部署方式：单机、集群、分布式（暂没有行存）


###   [1.1 需求来源](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#11-%E9%9C%80%E6%B1%82%E6%9D%A5%E6%BA%90)  

功能原始需求来源于“帆软适配”。

###   [1.2 调研文档](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#12-%E8%B0%83%E7%A0%94%E6%96%87%E6%A1%A3)  

  


###   [1.3 需求分析](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#13-%E9%9C%80%E6%B1%82%E5%88%86%E6%9E%90)  

我们对需求的分析，有相关联特性，可以附上关联文档。对交付特性涉及的质量属性各个方面进行概述，与第4章特性展开进行呼应。

###   [1.4 数据字典](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#14-%E6%95%B0%E6%8D%AE%E5%AD%97%E5%85%B8)  

|术语|描述|借鉴业界|参考|
|:---|:---|:---|:---|
|术语1|描述|是|业界资料链接|


###   [1.5 开源依赖](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#15-%E5%BC%80%E6%BA%90%E4%BE%9D%E8%B5%96)  

无

##   [2. 接口](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#2-%E6%8E%A5%E5%8F%A3)  

|接口|接口表现|接口说明|是否涉及|
|:---|:---|:---|:---|
|函数|支持median聚合函数|----|是|
|动态视图|v$function视图增加一个函数|----|是|


  


##   [3. 规格与约束](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

  


##   [4. 特性](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#4-%E7%89%B9%E6%80%A7)  

###   [4.1 特性功能点1：函数完整语法](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#42-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92%E5%87%BD%E6%95%B0%E5%AE%8C%E6%95%B4%E8%AF%AD%E6%B3%95)  

```
median = MEDIAN( [ ALL ] expr) [ OVER (query_partition_clause) ]

```

![](https://pingcode.yasdb.com/atlas/files/public/67396d38a1ad9a3311dc8fa2/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBRUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2MzgsImV4cCI6MTc4MjMxNzQzOH0.eOlbd5FIZDfo7yKbLhO9QJ3RllDwvTyUKq8a1-FI654)

（1）聚合函数：

- 禁用distinct语法


```
<span class="hljs-comment" style="color: rgb(136,136,136);">-- 实际例子：</span>
<span class="hljs-keyword">select</span> median(<span style="color: rgb(136,0,0);">expr</span>) <span class="hljs-keyword">from</span> t1;

```

（2）窗口函数部分：（已支持，不在本SR范围内）    `  
`  

###   [4.2 特性功能点2：函数算法](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#43-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B92%E5%87%BD%E6%95%B0%E7%AE%97%E6%B3%95)      `  
`  

记组内参数非空行数为N

- 如果N为奇数，则直接取组内非空第0.5*N行的参数值
- 如果N为偶数，则记0.5 * N向下取整的行数对应参数的值为floorValue，0.5 * N向上取整的行数对应参数的值为ceilValue，最终返回结果v1 + 0.5 * (v2 - v1)


###   [4.3 特性功能点3：参数](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#45-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B94%E7%BB%84%E5%86%85%E6%8E%92%E5%BA%8F%E9%94%AE)      [规格](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#45-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B94%E7%BB%84%E5%86%85%E6%8E%92%E5%BA%8F%E9%94%AE)  

（1）数据类型：数值型（tinyint\smallint\integer\bigint\number\binary_float\binary_double）、日期型 （date/timestamp/interval/time）

（2）个数：1 （小于或者超过1个则报错）

**函数返回值由排序键确定**

|排序键入参类型|函数出参类型|备注|
|:---|:---|:---|
|tinyint|number|  
|
|smallint|number|  
|
|integer|number|  
|
|bigint|number|  
|
|number|number|  
|
|binary_float|binary_float|  
|
|binary_double|binary_double|  
|
|date|date|  
|
|timestamp|timestamp|  
|
|time|time|  
|
|interval year to month|interval year to month|  
|
|interval day to second|interval day to second|  
|


###   [4.7 特性功能点6：组内数据对null值的处理](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#47-%E7%89%B9%E6%80%A7%E5%8A%9F%E8%83%BD%E7%82%B96%E7%BB%84%E5%86%85%E6%95%B0%E6%8D%AE%E5%AF%B9null%E5%80%BC%E7%9A%84%E5%A4%84%E7%90%86)  

计算组内总行数时忽略组内的空值，即计算组内百分比偏移时，null值的数量不会计算在内

###   [4.6 特性可维可测设计](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#46-%E7%89%B9%E6%80%A7%E5%8F%AF%E7%BB%B4%E5%8F%AF%E6%B5%8B%E8%AE%BE%E8%AE%A1)  

###   [4.7 特性安全设计](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#47-%E7%89%B9%E6%80%A7%E5%AE%89%E5%85%A8%E8%AE%BE%E8%AE%A1)  

###   [4.8 特性周边配合](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#48-%E7%89%B9%E6%80%A7%E5%91%A8%E8%BE%B9%E9%85%8D%E5%90%88)  

##   [5. Testcases（自测用例）](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#5-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

设计开发人员自测用例（文字描述），给出开发者自测试的设计方案表格或者XMIND、开发自测的用例归档路径。

自测关注点：

1. 覆盖全面
1. 避免重复测试
1. 测试用例的可维护性


自测用例设计方法：

1. 边界值
1. 等价类
1. 正交


自测覆盖用例场景：

1. 语法路径（有效、无效）
1. 参数入参有效与无效，结果正确与否
1. 聚合函数与其他函数混合使用的场景 （distinct、）
1. 数字类型与日期类型的边界值和精度
1. **构造不同算子走到聚合函数和窗口函数的场景**  (数据来源与不同算子，如有序的和无序的，正序的和反序的)
1. 大数据量场景下的正确性与性能
1. 不同部署方式下的函数正确性


等价类型：

1. 聚合函数部分
1. 窗口函数部分


##   [6.资料设计章节](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#6%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

资料在设计阶段，要识别出来相关需要调整的范围、大纲。

##   [7.未来规划](https://conf.yasdb.com/display/~zhongjinjian/YDBRD-26067+Percentile_Cont+Design#7%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

  


## Attachments: