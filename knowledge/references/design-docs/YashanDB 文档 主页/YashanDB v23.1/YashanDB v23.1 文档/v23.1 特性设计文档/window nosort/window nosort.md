Created by 钟金健 on 六月 01, 2023

# YDBRD-13218: 窗口函数支持索引

IR:    [[YDBRD-12249] 窗口函数支持索引，已排序数据 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-12249)  

SR:     [[YDBRD-13218] 窗口函数支持索引 - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-13218)  

##   [1. Overview（概述）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#1-overview%E6%A6%82%E8%BF%B0)  

该sr目标是实现window nosort算子。在下游表扫描算子提供的数据已经是索引列排好序的情况下，窗口函数可以直接使用已经排好序的数据进行窗口函数的运算，不需要重新进行排序。

##   [2. Features（功能特性）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

## 窗口函数语法图和基本规格：

  [窗口函数规格 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=72808743)  

## 窗口函数实现的相关算子

|算子类型|功能|本次sr是否需要实现|  
|
|---|---|---|---|
|Window Sort算子：,  
|窗口函数排序并计算窗口函数,  
|x（已实现）|  
|
|Window Buffer算子：|对窗口函数进行运算|x|Window Buffer与Window NoSort使用场景区分不明确，在yasdb统一为window nosort|
|Window NoSort算子|对数据顺序有要求，但物理顺序与逻辑顺序已经一致，不需要排序|√||
|Window Sort Pushed Rank|窗口函数作为filter的时候使用|x|  
|
|Window NoSort Stopkey|窗口函数作为filter的时候使用|x|  
|
|Window InSql Model Sort|按照指定的规则对窗口函数排序|x|  
|


待确认：是否添加新的算子？ 

结论：计划代码内部添加新的物理算子和逻辑算子，执行代码添加算子，对外表现为增加window nosort算子

现在yasdb支持的窗口函数有avg、count、dense_rank、first_value、lag、last_value、lead、listagg、max、min、rank、row_number、sum、median

## **算子使用条件：**

对于这个SR来说，只考虑下层算子是表扫描的情况。下层算子是表扫描，如果选上了索引使用索引扫描，并且索引扫描出来的数据已经满足窗口函数排序需求。这种场景下，就可以选用window nosort算子

更详细的使用场景，可以参考这篇调研文档：    [oracle窗口函数使用索引调研 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=107383953)  

## 排序要求1：窗口函数入参没有要求

- 对于窗口定义只有order by key的情况，排序要求key值有序
- 对于窗口定义只有partition by key的情况，排序要求key值有序
- 对于窗口定义有partiition by key1和order by key2的情况，排序要求(key1, key2)组合有序（单个key1有序或单个key2有序或key1和key2分别有序都不可以）
- 对于窗口定义有partition by key1,key2的情况，排序要求(key1, key2)组合有序（单个key1有序或单个key2有序或key1和key2分别有序都不可以）
- 对于窗口定义有partition by key1,key2的情况，排序要求(key1, key2)组合有序（单个key1有序或单个key2有序或key1和key2分别有序都不可以）
- 对于窗口定义有partition by key1,key2 order by key3, key4的情况，排序要求(key1, key2,key3,key4)组合有序


## 排序要求2：建索引是主键

- order by key中包含主键，优化掉在主键之后的剩余列
- partition by key中包含主键，优化掉part by非主键列及order by所有列
- unique索引在partition by中与主键类似，可以用排序要求2的第2条
- unique索引 + not null在order by中与主键类似，可以用排序要求的第2条


## 排序要求3：窗口函数入参有要求（如distinct，特殊函数需要对函数的入参进行排序）

当出现如下的场景时，窗口函数的排序需要满足1的基础上还需要满足参数的排序要求才能选择window nosort

- first_value\last_value，参数非强排序，如果按照排序要求1可以选择window nosort，则参数不需要单独排序。如果存在order by，则参数也会需要参与排序。
- median，参数强制排序，在排序要求1和要求2的基础上，还需要再满足按照参数进行排序的要求才能选择window nosort
- 参数入参有distinct选项的时候也是参数强制排序


  


##   [3. Interfaces（接口）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#3-interfaces%E6%8E%A5%E5%8F%A3)  

##   [4. Specification And Constraints（规格与约束）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#4-specification-and-constraints%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

##   [5. Detail Design（详细设计）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

对于window nosort

前置要求

- 一个公共list物化区（如果窗口函数超过1个，在没有窗口合并的情况下，是需要一个公共物化区缓存下层算子的数据）


火山模型

1. 首先判断是否现在数据是否是当前分区的最后一行，如果是，则开启新分区，否则继续在分区内进行窗口滑动
1. fetch一条数据，执行part key和order by key表达式，得到分区key值和排序的key值
1. 使用分区Key值判断是否是新的分区
1. 如果是新分区，执行建立新分区的前置操作（如记录分区key值，初始化分区offset，更新分区在窗口的offset），初始化分区物化区，然后将新fetch到的数据作为第一条数据缓存到分区物化区中。然后根据frame的类型进行窗口滑动运算
1. 如果不是新分区，则进行窗口滑动


简单场景，不需要物化区

|窗口函数\依赖window什么信息\函数阶段|begin|add|remove|finalize|  
|
|---|---|---|---|---|---|
|avg|\|\|\|\|  
|
|count|x|argKeyChanged|x|x|  
|
|dense_rank|x|sortKeyChange|\|x|  
|
|first_value|x|x|x|依赖物化区fetch与offset|  
|
|lag|x|x|x|依赖物化区fetch与offset|  
|
|last_value|x|x|x|依赖物化区fetch与offset|  
|
|lead|x|x|x|依赖物化区fetch与offset|  
|
|listagg|x|x|X|依赖物化区fetch与offset|  
|
|max|?|?|?|minMaxReCal,依赖物化区fetch|  
|
|min|?|?|?|同max|  
|
|rank|x|sortKeyChanged|\|x|  
|
|row_number|x|x|\|x|  
|
|sum|x|argKeyChanged|x|依赖物化区和window状态|finalize可以抽象一个fetch接口|
|median|x|x|x|依赖物化区和offset|  
|


  


![](https://pingcode.yasdb.com/atlas/files/public/67396ad08970c2af4f51ff6a/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTI5ODQsImV4cCI6MTc4MjIyMzc4NH0.UicwjrLW0oe6SI2-0C-rD4hYfS1lCeNZPF3sR70zgD8)

  


##   [6. Testcases（自测用例）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

- 基础功能（结果正确，与window sort算子结果对比，与oracle运算结果对比）
- 窗口函数性能提升（大数据量场景、小数据量场景，与window sort算子对比）


##   [7.资料设计章节](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#7%E8%B5%84%E6%96%99%E8%AE%BE%E8%AE%A1%E7%AB%A0%E8%8A%82)  

调研文档

  [oracle窗口函数使用索引调研 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=107383953)  

窗口函数基本语法和规格

  [窗口函数规格 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=72808743)  

##   [8. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

## Attachments: