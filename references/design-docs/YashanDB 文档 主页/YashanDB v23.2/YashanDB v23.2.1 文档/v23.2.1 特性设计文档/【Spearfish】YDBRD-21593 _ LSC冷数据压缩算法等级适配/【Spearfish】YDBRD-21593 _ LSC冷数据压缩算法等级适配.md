Created by 黄文早, last modified on 十二月 14, 2023

  [YDBRD-21593](https://jira.yasdb.com/browse/YDBRD-21593?src=confmacro)    -  LSC冷数据压缩算法等级适配  完成

#   [YDBRD-21593 : LSC冷数据压缩算法等级适配](#ydbrd-21593--lsc冷数据压缩算法等级适配)  

SR链接：    [https://jira.yasdb.com/browse/YDBRD-21593](https://jira.yasdb.com/browse/YDBRD-21593)  

##   [1. Overview（概述）](#1-overview概述)  

​		现今不同的列存数据库，支持各种各样的压缩算法，这些压缩算法，一方面降低了存储成本，另一方面降低访问数据需要的io量，大大提升了查询速度。目前lsc 冷数据支持zstd和lz4 压缩算法，为了更好的压缩效果，需要调研各种压缩算法之间的异同，考察是否需要引入新的压缩算法，并向客户给出建议，引导客户根据自身使用场景，使用合适的压缩算法。

##   [2. Features（功能特性）](#2-features功能特性)  

|功能|设计表现|设计说明|
|---|---|---|
|调整不同压缩算法低，中，高对应的等级|不同压缩等级压缩效果发生变化|不同等级具有不同的压缩效果，低压缩速度快，压缩比低，高压缩速度慢，压缩比高|
|lsc 冷数据，列的压缩算法可以指定等级|指定列压缩后，压缩效果发生改变|之前列压缩使用的压缩接口忽略压缩等级|
|lsc 冷数据默认压缩配置参数默认为LZ4 LOW|默认压缩算法发生改变|大多数用户场景，lz4对于存储和查询性能都有提升|


##   [3. Interfaces（接口）](#3-interfaces接口)  

​		指定列压缩等级和表压缩等级，语法现已支持，可参考    [https://cod-doc.yasdb.com/yashandb/22.1-dp-de/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE.html](https://cod-doc.yasdb.com/yashandb/22.1-dp-de/zh/%E5%BC%80%E5%8F%91%E6%89%8B%E5%86%8C/SQL%E5%8F%82%E8%80%83%E6%89%8B%E5%86%8C/SQL%E8%AF%AD%E5%8F%A5/CREATE%20TABLE.html)  

##   [4. Specification And Constraints（规格与约束）](#4-specification-and-constraints规格与约束)  

​		调整编码等级会影响备份压缩的速度。为保证压缩和等级在数据库内概念一致性，冷数据和备份压缩的等级和LSC表冷数据使用相同的等级

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

​		调研结果    [https://conf.yasdb.com/pages/viewpage.action?pageId=133565595](https://conf.yasdb.com/pages/viewpage.action?pageId=133565595)  

​		    [https://conf.yasdb.com/pages/viewpage.action?pageId=133572643](https://conf.yasdb.com/pages/viewpage.action?pageId=133572643)  

​		压缩等级与压缩参数关系如下

|编码类型|编码等级|实际编码等级|压缩率|压缩速度|解压速度|
|---|---|---|---|---|---|
|LZ4|低|lz4 default|46.14|580|2312|
|LZ4|中|LZ4HC|39.92|102|2369|
|LZ4|高|lz4HC -4|37.3|63.3|2383|
|ZSTD|低|1|27.68|312|890|
|ZSTD|中|4|26.42|179|764|
|ZSTD|高|7|25.59|55.2|806|
|LZMA|ALL|0|21.37|25.8|62.3|


###   [5.3 Compatibility（兼容性）](#53-compatibility兼容性)  

​	不同压缩等级使用相同的压缩算法，不需要额外存储压缩等级，不涉及兼容性变更。

###   [5.4 DFX设计](#54-dfx设计)  

当前v$sysstat 中已有冷数据压缩和解压耗时统计。

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

自测用例：

1. 增加不同压缩等级sql用例，并查看结果
1. 验证tpch 不同压缩等级测试效果


##   [7.资料设计章节](#7资料设计章节)  

​		向客户提供不同类型压缩，不同等级压缩的建议。

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

​		无

## Attachments:

[test.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjM4OTcwYzJhZjRmNTIwYmNkIiwicmVmX2lkIjoiNjczOTZjNjM1OTNmOTljOWZmMjM2ZTFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTYwLCJleHAiOjE3ODIzODY5NjB9.f7x04WftOGWUGN_OpuZWPWtC8zGYqUe8rF4cC-O5nIc)

 (application/octet-stream)    


[test.sql](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjNhMWFkOWEzMzExZGM4YTNjIiwicmVmX2lkIjoiNjczOTZjNjM1OTNmOTljOWZmMjM2ZTFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTYwLCJleHAiOjE3ODIzODY5NjB9.3JDs6biYegR6_REL1pVjMWDhJ9rX1Fe3_XCPSW2SCao)

 (application/octet-stream)    


[placeholder-medium-file.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjNjQ4OTcwYzJhZjRmNTIwYmNmIiwicmVmX2lkIjoiNjczOTZjNjM1OTNmOTljOWZmMjM2ZTFiIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzAwNTYwLCJleHAiOjE3ODIzODY5NjB9.i6_DE6cWvSau-BuhL2qEHwKpvz6o7KJ6t81Z3Kmmnqc)

 (image/png)    
