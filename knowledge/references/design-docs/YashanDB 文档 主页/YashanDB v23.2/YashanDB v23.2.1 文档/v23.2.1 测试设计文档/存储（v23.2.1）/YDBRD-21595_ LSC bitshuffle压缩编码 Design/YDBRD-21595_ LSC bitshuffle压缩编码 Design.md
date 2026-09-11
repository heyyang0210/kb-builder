Created by 卢凯舜, last modified on 十二月 06, 2023

# 1. 概述

不同于其他以extent为单位的压缩算法，bitshuffle是以block为单位进行一种类似转置的编码后，再进行lz4压缩的算法，可以加速压缩，提升性能。

因此针对coast 列压缩，涉及页面压缩解压与block层面的数据处理。

2. 需求分析

sr：    [YDBRD-21595](https://jira.yasdb.com/browse/YDBRD-21595?src=confmacro)    -  LSC支持bitshuffle重排改进压缩效果  完成

开发文档：    [YDBRD-21595: LSC bitshuffle压缩编码 Design（LSC bitshuffle压缩编码方案设计） - 雷雨璐 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=133594152)  

## 2.1 功能点分析

*语法  无语法变动*

![](https://pingcode.yasdb.com/atlas/files/public/67396be4a1ad9a3311dc864c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFCRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc2MTYsImV4cCI6MTc4MjMwODQxNn0.Y1q2iEdU1HHrAzFOTJo-ucjElSLW_Nfd6XH5eu0rDBw)

![](https://pingcode.yasdb.com/atlas/files/public/67396be4a1ad9a3311dc864d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFFQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFCRUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTc2MTYsImV4cCI6MTc4MjMwODQxNn0.Y1q2iEdU1HHrAzFOTJo-ucjElSLW_Nfd6XH5eu0rDBw)

```
<span class="token rule">syntax</span>::<span class="token operator" style="color: rgb(103,205,204);">=</span> <span class="token rule">column dataType</span> <span class="token punctuation" style="color: rgb(204,204,204);">[</span><span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">DEFAULT default_expr</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">codec_expr</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">inline_constraint</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span>
<span class="token punctuation" style="color: rgb(204,204,204);">{</span><span class="token string" style="color: rgb(126,198,153);">" "</span> <span class="token punctuation" style="color: rgb(204,204,204);">(</span><span class="token rule">DEFAULT default_expr</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">codec_expr</span><span class="token operator" style="color: rgb(103,205,204);">|</span><span class="token rule">inline_constraint</span><span class="token punctuation" style="color: rgb(204,204,204);">)</span><span class="token punctuation" style="color: rgb(204,204,204);">}</span><span class="token punctuation" style="color: rgb(204,204,204);">]


</span>
```

  [compression_typ](https://cod-doc.yasdb.com/yashandb/alpha/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE.html#compressiontype)    ** **  添加bitshuffle的压缩编码算法，比lz4与zstd压缩速度更快，可以更好的进行向量化压缩。

## 2.2 应用场景

- *需求本身的主要应用场景*
    - *用户指定*
- *需求与其他特性的关联场景*


## 2.3 规格约束

- 表空间透明压缩不适配


# 3. 测试设计方法 

## 3.1 测试设计方法

*语法：主要采用等价类划分的方式，划分有效等价类和无效等价类进行覆盖*

*功能：*  *采用场景法，验证带*  *BITSHUFFLE*  *各个对象操作功能正常*

*测试范围*

- 部署模式：单机，分布式
- 表类型：lsc、分布表、复制表
- 不同数据类型，默认值   INTEGER、UINTEGER、FLOAT、DOUBLE
    - 数值类型，  含时间，number等类型
    - 浮点型


看压缩率，查询没有问题，解析不乱码

## 3.2 详细测试设计

*1)使用章节3.1的测试方法设计详细的功能测试点，可借用xmind的方式*

数据类型

|数据类型|  
|  
|
|---|---|---|
|数值类型|int/bigint/smallint|  
|
|  
|时间类型|  
|
|  
|number类型|  
|
|浮点型|float|  
|
|  
|double|  
|
|  
|  
|  
|
|  
|  
|  
|


分区表等价划分

|输入条件|有效等价类|编号|无效等价类|编号|
|:---|:---|:---|:---|:---|
|分区类型|range、list、hash分区|  
|  
|  
|
|二级分区|9种|  
|  
|  
|
|分区名称|不指定分区名称|  
|  
|  
|
|分区类型|range分区|  
|  
|  
|
|分区键列数|单列|  
|  
|  
|
|  
|list分区|  
|  
|  
|
|  
|hash分区|  
|  
|  
|
|  
|指定分区名称|  
|  
|  
|
|  
|多列|  
|  
|  
|


场景测试

|序号|测试场景||用例详细描述|预期|备注|
|:---:|:---:|---|---|:---:|:---:|
|  
|覆盖不同数据类型|  
|num类型不指定|1.支持bitshuffle的lz4类型会默认转换成bitshuffle,2.其他类型仍为lz4类型|  
|
|  
|覆盖不同类型分区表|  
|  
|  
|  
|
|  
|覆盖不同表空间|  
|*加密表空间、压缩表空间、自定表空间、bucket表空间、mms表空间、内建表空间*|透明加密表空间不支持|  
|
|  
|对压缩列做dml操作正常|insert|  
|带子查询等正常|  
|
|  
|  
|delete|  
|  
|  
|
|  
|  
|update|  
|  
|  
|
|  
|对压缩列做ddl操作正常|alter 操作|1.alter 添加、删除、修改列,2.从支持bitshuffle的数据类型到不支持bitshuffle的数据类型|  
|  
|
|  
|  
|drop|  
|  
|  
|
|  
|  
|truncate|  
|  
|  
|
|  
|create操作|创建索引|索引覆盖：  *BTREE、RTREE、普通索引、local索引、唯一索引*|  
|  
|
|  
|  
|创建视图|  
|  
|  
|
|  
|  
|创建物化视图|  
|  
|  
|
|  
|  
|创建  comment|  
|  
|  
|
|  
|  
|以压缩列创建force视图|  
|  
|  
|
|  
|冷热数据转换|alter slice正常|  
|  
|  
|
|  
|对压缩列创建ac，做相关操作|  
|创建AC，查询LSC、AC相关视图|  
|  
|
|  
|结合字典编码|  
|字典编码列哪些走bitshuffle，开发文档明确|  
|  
|
|  
|逻辑复制日志|  
|  
|  
|  
|
|  
|对压缩列做yasminer解析|  
|  
|  
|  
|
|  
|升级场景|  
|旧版本建表，插数，准备冷数据和热数据，再升级，升级到新版本后查询验证，再插数转换查询验证|  
|  
|
|  
|并发|创建带压缩列的表并发|  
|  
|  
|
|  
|  
|建表+ddl+dml|  
|  
|  
|
|  
|ha场景|基线|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|
|  
|  
|  
|  
|  
|  
|


*性能测试*

*比较bitshuffle压缩和lz4压缩压缩速率和压缩率，覆盖上述数据类型*

|数据类型|数据量|压缩类型|  
|  
|  
|
|---|---|---|---|---|---|
|数值类型|1w|*bitshuffle*|  
|  
|  
|
|浮点型|10w|*lz4*|  
|  
|  
|
|  
|100w|zstd|  
|  
|  
|
|  
|1000w|  
|  
|  
|  
|


（1）确认bitshuffle编码对存储消耗压缩比，预期与lz4压缩比一致

（2）确认compress、decompress耗时，预期bitshuffle编码decompress性能会下降，compress性能会提升

  


*2)*  *梳理该特性是否涉DFX测试，并在详细设计中描述具体测试点，可借用xmind的方式*

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|是|
|KT|是|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|是|
|压力|  
|
|性能|是|
|可维护性|  
|


4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[image2023-12-1_11-45-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTRhMWFkOWEzMzExZGM4NjQ2IiwicmVmX2lkIjoiNjczOTZiZTQ1OTNmOTljOWZmMjM2N2VjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjE1LCJleHAiOjE3ODIzODQwMTV9.Xp1wIpA5FIp1YU0JPa9A-RGExuQOpdCGkflDrKxv3fY)

 (image/png)    


[image2023-12-1_11-48-23.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTRhMWFkOWEzMzExZGM4NjQ3IiwicmVmX2lkIjoiNjczOTZiZTQ1OTNmOTljOWZmMjM2N2VjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjE1LCJleHAiOjE3ODIzODQwMTV9.FNYFOHQmvw_YHxbSOTaO5Tft3qbLyRxWo6IH265GSW8)

 (image/png)    


[image2023-12-1_11-48-45.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTQ4OTcwYzJhZjRmNTIwN2Q0IiwicmVmX2lkIjoiNjczOTZiZTQ1OTNmOTljOWZmMjM2N2VjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjE1LCJleHAiOjE3ODIzODQwMTV9.5IPWd_LpDiZjXJoWV5CqKpcLMiwZHf1AB2UU6WONcOA)

 (image/png)    


[image2023-12-1_11-51-24.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTRhMWFkOWEzMzExZGM4NjQ4IiwicmVmX2lkIjoiNjczOTZiZTQ1OTNmOTljOWZmMjM2N2VjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjE1LCJleHAiOjE3ODIzODQwMTV9.7116jeTDSEJQk1aB87XDgtAnfadeZiTRZRHdW6mjUok)

 (image/png)    


[image2023-12-1_11-51-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZTQ4OTcwYzJhZjRmNTIwN2Q2IiwicmVmX2lkIjoiNjczOTZiZTQ1OTNmOTljOWZmMjM2N2VjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3NjE1LCJleHAiOjE3ODIzODQwMTV9.UqUYniDw0aqsZX_VBSRxTvvBzfiiuyvYKGNwDpditRc)

 (image/png)    
