Created by 许秋莹 on 十月 14, 2024

IR链接：    [YDBRD-23557](https://jira.yasdb.com/browse/YDBRD-23557?src=confmacro)    -  TPCDS优化-实现窗口函数两阶段  设计中

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

TPCDS 的 Query67 语句，发现窗口函数的 filter 没有下推到 DN 节点上，造成在 CN 上处理大量数据量，执行时间过长，性能较差。因此需要将将窗口函数的 filter 下推到 DN 节点，其中可以将部分 filter 改写成 TopN 的方式，挂在到窗口函数上，并且需要将窗口函数下推到 DN 上执行，才能达到最终的效果。

##   [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

实现分布式窗口函数的 filter 下推两阶段功能，将窗口函数的 filter 下推到 DN 节点。

##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

1、只支持 rank 函数 filter 的两阶段功能

2、TopN 只支持带有 rank 函数的窗口函数列，filter 条件满足： rank 窗口函数列 <、=、<= 常量；或者，常量 >、=、>= rank 窗口函数列

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

TPCDS 涉及 rank 窗口函数列的 filter 比较场景。

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

       1、窗口函数列覆盖所有数据类型

       2、测试数据具有随机性无序性、包含 NULL、重复值、非重复值、特殊字符等

       3、本需求涉及 filter 下推，因此需要考虑所有的谓词和谓词所在的任意位置：

            1）谓词覆盖：  =、<、<=、>、>=、!=、<>、     [ANY|SOME|ALL]、[NOT] BETWEEN.. AND、[NOT] IN、[NOT] LIKE、[NOT] RLIKE、[NOT] EXISTS、IS [NOT] NULL、ROWNUM

            2）谓词所在的位置：where、having、join on

       4、谓词两边的位置互换：rank 窗口函数列在左、rank 窗口函数列在右

       5、filter 条件值覆盖：

            1）常量

            2）可隐式转换的列

            3）函数

            4）表达式

            5）ROWNUM

            6）普通子查询：   带   [ANY|SOME|ALL]、不带      [ANY|SOME|ALL]、覆盖关联子查询、非关联子查询

            7）join 子查询

            8）集合子查询

            9）View 子查询

       6、filter 查询的对象：分布表、分布分区表、临时表、复制表、View 视图

       7、filter 条件个数：1个、多个（跟开发确认一下下推规格上限，超过多少个就不下推，测下边界值）

            1）只包含 rank 窗口列的 filter 条件

            2）rank 窗口列的 filter 条件和 ROWNUM 条件组合

            3）rank 窗口列的 filter 条件和其他可下推的数据类型列的 filter 条件组合

            4）rank 窗口列的 filter 条件和其他可不下推的数据类型列的 filter 条件组合

            5）可下推的 rank 窗口列的 filter 条件和不可下推的 rank 窗口列的 filter 条件组合

      8、覆盖子查询（多层子查询嵌套，如   select * from (select rank() over(partition by c1 order by c2) rk1, rank() over(partition by c2 order by c3) rk2 from test) where rk1 <= 3 and rk2 <= 2 and c1 < 5;  ）、CASE ... WHEN、CTE、join 查询（关注复制表与分布表混合）、集合查询（关注复制表与分布表混合）

      9、filter 列为其他窗口函数的列：sum/avg/count/min/max/listagg/first_value/last_value/median/lag/lead/dense_rank/row_number，结果正确且 filter 不下推

      10、投影列个数：1个、多个（1024、4096）

            1）投影列包含：rank 窗口函数

            2）投影列包含：非 rank 的其他窗口函数

            3）聚集函数

            4）普通函数

            5）表达式

            6）普通列

            7）常量

            8）NULL

     11、投影列包含函数嵌套：如 MAX(SUM(distinct account))OVER(ORDER BY month)、COUNT(RANK() OVER (ORDER BY mark))，函数嵌套个数：达到边界（127？）

     12、以上并行场景

     13、结果集大于一个批次（columnar_bulk_size，调小 columnar_bulk_size = 1、或其他值 ）

     14、资源不足的场景，下推功能的表现结果是否合理

     15、访问计划的正确性

  


###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

ct/kt：rank 窗口列 filter 下推并发、窗口列 filter 下推与不下推并发、窗口列 filter 与其他 filter 并发

长稳：数据量较大的场景

性能：TPCDS Query 67 的性能

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

自动化看护

##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

无

  


## Attachments:

[image2023-10-25_18-57-36.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZGY4OTcwYzJhZjRmNTIwZWQzIiwicmVmX2lkIjoiNjczOTZjZGY3MjgyMDZlZmI5MmYxN2QxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0MTU2LCJleHAiOjE3ODIzOTA1NTZ9.R2DE0vaY8YysBX-23o0xADg-DN4oy0nkOG-20EbgsPs)

 (image/png)    


[image2023-10-25_18-57-9.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZGZhMWFkOWEzMzExZGM4ZDQ1IiwicmVmX2lkIjoiNjczOTZjZGY3MjgyMDZlZmI5MmYxN2QxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0MTU2LCJleHAiOjE3ODIzOTA1NTZ9.ehpKaqLjQRm6KMSHwgj82dg8JfEAu-V1zRQh1Hkaix0)

 (image/png)    


[image2023-10-25_18-56-59.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZGY4OTcwYzJhZjRmNTIwZWQ1IiwicmVmX2lkIjoiNjczOTZjZGY3MjgyMDZlZmI5MmYxN2QxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0MTU2LCJleHAiOjE3ODIzOTA1NTZ9.6DNuPodQNh8vo72PSXz6J507cHyPKqlp4q3MBQLgzbM)

 (image/png)    


[image2023-10-25_18-56-42.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZjZGY4OTcwYzJhZjRmNTIwZWQ2IiwicmVmX2lkIjoiNjczOTZjZGY3MjgyMDZlZmI5MmYxN2QxIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzA0MTU2LCJleHAiOjE3ODIzOTA1NTZ9.V1lmAnRUdumKR-HW5ToW7Kx1fr47IO6hzyXzaISiook)

 (image/png)    
