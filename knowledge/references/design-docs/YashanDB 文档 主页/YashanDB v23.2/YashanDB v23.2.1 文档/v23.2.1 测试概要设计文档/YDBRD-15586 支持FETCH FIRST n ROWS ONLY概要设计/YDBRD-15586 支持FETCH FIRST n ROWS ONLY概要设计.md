Created by 刘晓旋, last modified on 十二月 13, 2023

IR链接：    [YDBRD-15436](https://jira.yasdb.com/browse/YDBRD-15436?src=confmacro)    -  支持FETCH FIRST n ROWS ONLY功能  完成

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

本需求支持 FTETCH FIRST n ROWS ONLY 的功能，实现 OFFSET offset ROWS FETCH FIRST rowcount ROWS ONLY;  取出 n 行数据，和 LIMIT OFFSET 实现的功能相同。

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

Oracle 语法：

![](https://pingcode.yasdb.com/atlas/files/public/67396b76a1ad9a3311dc832b/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQUFBQUFBQUJBQUFBRUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBRUFBQUFBQkFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQ0NzQsImV4cCI6MTc4MjMwNTI3NH0._-csYR9H5-0erPZV41F_Q9M9-PcH-mPrHSzPxdSmJK8)

|参数|说明|
|:---|:---|
|offset|为 NULL 或者大于实际行数时都返回 0 行； 为负数时都按 0 处理； 为小数时都直接向下取整|
|rowcount|为 NULL 时返回 0 行，大于实际最大行数时返回所有行，负数时都按 0 处理； 为小数时都直接向下取整|
|percent|根据返回总数进行相乘，有小数时直接进行向上取整，大于 100 返回所有，小于等于 0 或为 NULL 返回 0 行|


1. ROW 和 ROWS 语法含义相同，Oracle 官方文档解释为 row 和 rows 可以互相替换使用，为提供清晰的语义而设定两个关键字。

2. FIRST 和 NEXT 语法含义相同

3. ONLY:  返回 OFFSET+1 位置起的 rowcount 行数据

4. WITH TIES: 有 ORDER BY 关键字时起作用，除了返回 fetch 对应数据，还会返回 order by 列和最后一行相同的结果集，实际返回数量大于 rowcount，没有 order by 时和 only 语法含义相同

5. PERCENT: 返回 rowcount 乘以 percent 数量的数据

  


DB2  语法;

![](https://pingcode.yasdb.com/atlas/files/public/67396b768970c2af4f5204b4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFDQUFBQUFBQUJBQUFBRUFBQUFBQUFBQUFBQUFJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBRUFBQUFBQkFBQUFBQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTQ0NzQsImV4cCI6MTc4MjMwNTI3NH0._-csYR9H5-0erPZV41F_Q9M9-PcH-mPrHSzPxdSmJK8)

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

目前语法上对齐 DB2，不支持 WITH TIES 和 PERCENT。

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

与 limit offset 一致

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

1. fetch 语法测试
1. offset 语法测试
1. offset fetch 语法测试
1. 投影列覆盖所有数据类型 + offset fetch
1. group by/order by/connect by/distinct + offset fetch
1. join + offset fetch
1. 集合 + offset fetch
1. 子查询 + offset fetch
1. view + offset fetch
1. rowcount、offsetcount 为数值、函数、表达式、边界值测试、NULL
1. 并行 + offset fetch
1. 分区表 + offset fetch
1. 临时表 + offset fetch
1. offset fetch 与 limit offset 组合使用
1. fetch offset 作为别名
1. 视图 v$reserved_word 新增关键字


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

ct/kt：offset fetch 之间并发、offset fetch 与 limit offset 并发

长稳：数据量较大的情况

性能：与 limit offset 的性能作对比

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

自动化看护

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

无

  


## Attachments:

[image2023-10-25_18-57-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzVhMWFkOWEzMzExZGM4MzI2IiwicmVmX2lkIjoiNjczOTZiNzU1OTNmOTljOWZmMjM2MmRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NDc0LCJleHAiOjE3ODIzODA4NzR9.dj2SAOaToWbf0xZXxHgj23ejKuNk_ngB5zDXPLrwSqg)

 (image/png)    


[image2023-10-25_18-57-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzU4OTcwYzJhZjRmNTIwNGIyIiwicmVmX2lkIjoiNjczOTZiNzU1OTNmOTljOWZmMjM2MmRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NDc0LCJleHAiOjE3ODIzODA4NzR9.nuJVzSpxz28YBt2tfI428NWjIw4Uqe8SCzGpvr0w00I)

 (image/png)    


[image2023-10-25_18-56-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzVhMWFkOWEzMzExZGM4MzI4IiwicmVmX2lkIjoiNjczOTZiNzU1OTNmOTljOWZmMjM2MmRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NDc0LCJleHAiOjE3ODIzODA4NzR9.qhidjo_MYVLSPDJ5-glbox_E0yP8iS_yVd62o3HfSdY)

 (image/png)    


[image2023-10-25_18-56-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiNzVhMWFkOWEzMzExZGM4MzI5IiwicmVmX2lkIjoiNjczOTZiNzU1OTNmOTljOWZmMjM2MmRhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk0NDc0LCJleHAiOjE3ODIzODA4NzR9.uVi_Zqhuxt1HzEAjR3FL3cEmFcE-tCYS55e4IE9hLHI)

 (image/png)    
