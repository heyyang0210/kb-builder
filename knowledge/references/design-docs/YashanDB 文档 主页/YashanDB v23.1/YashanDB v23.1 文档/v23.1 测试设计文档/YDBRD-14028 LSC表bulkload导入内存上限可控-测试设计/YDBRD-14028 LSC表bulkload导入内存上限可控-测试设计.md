Created by 陈钦卿, last modified on 十月 12, 2024

# 1、概述

导入/转换所需的SCOL_DATA_BUFFER_SIZE和COLUMNAR_VM_BUFFER_SIZE可控

SR:     [YDBRD-14028](https://jira.yasdb.com/browse/YDBRD-14028?src=confmacro)    -  【2023.1】LSC表bulkload导入内存上限可控  完成

开发设计：    [【Spearfish】LSC稳态数据导入内存优化方案设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104211463#52-%E6%8D%A2%E5%85%A5%E6%8D%A2%E5%87%BA%E7%AE%97%E6%B3%95)  

  [YDBRD-11671：LSC表bulkload导入改进点讨论 - 陈宜顺 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=104210364)  

# 2、需求分析

## 2.1 前提：

**LSC表 & ENABLE_BULK=TRUE**

|  
|默认|范围|修改立即生效|备注|
|---|---|---|---|---|
|SCOL_DATA_BUFFER_SIZE|128M|[128M, 2T]|否|  
|
|COLUMNAR_VM_BUFFER_SIZE|2G|[128M,2T]|是|LSC的Bulkload导入/转换所需最小内存配置COLUMNAR_VM_BUFFER_SIZE = 1GB，小于不报错，但是有可能导入期间内存分配失败|


## 2.2 方案思路：

当内存不足时，采用  **换入换出(FIFO)**  的方式，把部分Bulkload期间暂时不用的缓冲区内存写到临时文件中，当需要使用时再换入内存来使用

**换入换出的编码类型**

|编码类型|是否支持换入换出|备注|
|:---|:---|:---|
|CODEC_PLAIN|支持|  
|
|CODEC_DICT_AUX|支持|  
|
|CODEC_DICT_PLAIN|支持|  
|
|CODEC_DICT|支持|  
|
|CODEC_BIT_RLE_HYBRID|不支持|仅INT和BIGINT需要支持RLE，单列最大内存占用约21K，换入换出代价大，且内存节省效果不明显|
|CODEC_BOOL|不支持|Bool类型占用内存少，单列只需要512字节（4000/8）的缓冲区，换入换出代价大，且内存节省效果不明显|
|CODEC_NUMBER|不支持|Buffer占用最多是4K * 20 * 4K = 320MB，在可控范围内，不需要换入换出|


  


换入换出的数据选定原则：不是所有数据都需要换入换出，尽可能选择大块内存进行淘汰，小块内存尽可能不淘汰，减少换入换出带来的IO开销。

# 3、功能与限制

1. 内存最小配置下不保证性能，过小可能影响导入速度，当出现影响导入速度的情况时在运行日志里面打印WARNING级别日志。
1. 最小内存配置仍然与DOP挂钩，最小内存配置需要指定DOP=2


# 4、详细测试设计

最小配置

SCOL_DATA_BUFFER_SIZE=128M

COLUMNAR_VM_BUFFER_SIZE=1G

**实际用量：（表1分区数*1G + 表2分区数*1G + ... + 表N分区数*1G）*（DOP-1）**

分区数多占用内存大，使用文件拆分解决。    [YDBRD-12006](https://jira.yasdb.com/browse/YDBRD-12006?src=confmacro)    -  支持一键式文件拆分后再导入  完成

单机使用om部署，可用文件一键拆分导入。若手动yasdb建库，则无法使用。

  


故：本SR主要关注少量分区，少量表。（难道只有单表单分区能触发换入换出？）

多表多分区的情况下不触发换入换出！！

  


|数据类型|编码类型|压缩级别|正交组合|
|---|---|---|---|
|TINYINT/SMALLINT/大对象型|PLAIN编码|LOW、MEDIUM、HIGN|1、表中只有一种数据类型，一种编码类型，一种压缩级别,2、一种数据类型，一种编码类型，不同压缩级别,3、一种数据类型，不同编码类型，不同压缩级别,4、不同数据类型，不同编码类型，不同压缩级别,5、表中部分列指定压缩编码|
|INT/BIGINT/FLOAT/DOUBLE/日期型|PLAIN编码/RLE编码/字典编码|LOW、MEDIUM、HIGN||
|字符型|PLAIN编码/字典编码|LOW、MEDIUM、HIGN||
|NUMBER型|PLAIN编码/  BYTE-PACKED编码|LOW、MEDIUM、HIGN||


### 观测手段

v$sysstat新增7个统计值：

```
[cys@AchorBase anchorbase]$ rlwrap $YASDB_HOME/bin/yasql sys/Cod-2022@127.0.0.1:1688 -c "<span class="hljs-keyword">select</span> * <span class="hljs-keyword">from</span> v\$sysstat <span class="hljs-keyword">where</span> <span class="hljs-keyword">name</span> <span class="hljs-keyword">like</span> <span class="hljs-string" style="color: rgb(136,0,0);">'SCOL SWAP%'</span> <span class="hljs-keyword">or</span> <span class="hljs-keyword">name</span> <span class="hljs-keyword">like</span> <span class="hljs-string" style="color: rgb(136,0,0);">'SCOL BULKLOAD%'</span><span class="hljs-string" style="color: rgb(136,0,0);">" 

  STATISTIC# NAME                                                                    CLASS                 VALUE 
------------ ---------------------------------------------------------------- ------------ --------------------- 
         432 SCOL SWAP OUT CNT                                                           8                 11183
         433 SCOL SWAP IN CNT                                                            8                  7924
         434 SCOL SWAP OUT WRITE BYTES                                                   8           30084929063
         435 SCOL SWAP IN READ BYTES                                                     8          103376678319
         436 SCOL SWAP OUT FREE BYTES                                                    8          115806799440
         437 SCOL SWAP IN ALLOC BYTES                                                    8                     0
         438 SCOL BULKLOAD WRITE SYNC CNT                                                8                     1

7 rows fetched.
</span>
```

|名称|统计项含义|统计意义|
|:---|:---|:---|
|SCOL SWAP OUT CNT|导入/后台转换过程中因COLUMNAR_VM_BUFFER不足而产生的换出次数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL SWAP IN CNT|导入/后台转换过程中因COLUMNAR_VM_BUFFER不足而产生的换入次数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL SWAP OUT WRITE BYTES|导入/后台转换过程中因COLUMNAR_VM_BUFFER不足而产生的写盘字节数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL SWAP IN READ BYTES|导入/后台转换过程中因COLUMNAR_VM_BUFFER不足而产生的读盘字节数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL SWAP OUT FREE BYTES|导入/后台转换过程中换出释放的COLUMNAR_VM_BUFFER字节数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL SWAP IN ALLOC BYTES|导入/后台转换过程中换入申请的COLUMNAR_VM_BUFFER字节数|单位时间内增长的速度越快，导入速度越慢，调大COLUMNAR_VM_BUFFER_SIZE可缓解|
|SCOL BULKLOAD WRITE SYNC CNT|导入/后台转换过程中因SCOL_DATA_BUFFER不足产生的同步写次数|单位时间内增长的速度越快，导入速度越慢，调大SCOL_DATA_BUFFER_SIZE可缓解|
