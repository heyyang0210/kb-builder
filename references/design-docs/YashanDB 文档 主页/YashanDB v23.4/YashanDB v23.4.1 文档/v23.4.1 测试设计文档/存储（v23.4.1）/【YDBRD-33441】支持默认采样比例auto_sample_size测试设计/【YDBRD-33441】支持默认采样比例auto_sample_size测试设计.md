# 

﻿﻿﻿﻿﻿﻿﻿SR链接：：  [ https://pingcode.yasdb.com/pjm/items/6704a721e489dd0868f192f2?  ](https://pingcode.yasdb.com/pjm/items/6704a721e489dd0868f192f2?)  #YDBRD-33441 支持默认采样比例auto_sample_size

开发设计：  [(1392) 知识管理 - PingCode](https://pingcode.yasdb.com/wiki/spaces/YASDOC/pages/67a5aa84d06ac74ecc3ff524)  

# 1. 概述

通过常量 DBMS_STAT.AUTO_SAMPLE_SIZE来指定自动采样率，含义为数据库自动决定采样率，如果不指定或者是0 则采用自动采样率。

# 2. 需求分析

## 2.1 功能点分析

1.存储过程GATHER_TABLE_STATS，GATHER_INDEX_STATS，GATHER_SCHEMA_STATS，GATHER_DATABASE_STATS 存储过程中的 estimate_percent 参数 支持设置成 DBMS_STAT.AUTO_SAMPLE_SIZE，设置后数据库将自动决定采样率。

2.支持通过SET_TABLE_PREFS设置DBMS_STATS.AUTO_SAMPLE_SIZE

3.默认的采样率变为自动采样率，原来是1。

4.范围：

支持形态：单机，集群

支持的表类型：HEAP，LSC，TAC

## 2.2 应用场景

```
--主成功场景
```

```
--建表导入不同的数据量
```

```
--指定自动采样方式收集统计信息
```

```
--确认收集的统计信息以及采样率
```



## 2.3 规格约束

1.不适用于动态采样，只适用于通过DBMS_STATS高级包进行的统计信息收集。

2.DBMS_STATS.AUTO_SAMPLE_SIZE 不区分大小写，不能写为AUTO_SAMPLE_SIZE。不能写成字符串。该常量用于其他参数，不报错，默认识别为0。

# 3. 详细测试设计

## 3.1 测试设计方法

主要采用等价类划分，场景法组合进行设计

## 3.2 详细测试设计

1.功能测试测试点分析

||||
|---|---|---|
|输入条件|有效等价类|备注|
|参数语法|大小写混写,尾部多字符,单引号,双引号|﻿  
|
|设置方式|对表通过SET_TABLE_PREFS 设置|﻿  
|
|表类型|heap，lsc，tac|﻿  
|
|表结构|非分区表，分区表|﻿  
|
|列类型|全部列类型|﻿  
|
|数据量|数据 blocks小于128k,数据 blocks大于128k,数据blocks远大于128k|﻿  
|
|收集方式|GATHER_TABLE_STATS,GATHER_INDEX_STATS,GATHER_SCHEMA_STATS,GATHER_DATABASE_STATS |﻿  
|


2.场景测试分析

--

# 4. 测试用例

|用例编号|测试内容|预期|备注|
|---|---|---|---|
|1|参数有效性设置|DBMS高级包SET_TABLE_PREFS中的estimate_percent 参数 ,设置DBMS_STATS.AUTO_SAMPLE_SIZE  不缺分大小写，设置成功,设置AUTO_SAMPLE_SIZE，报错,带单引号，双引号 报错,尾部多出其他符号，报错|﻿  
|
|2|其他参数使用测试|DBMS高级包存储过程中的除estimate_percent 之外的参数,支持设置成0的参数设置不报错，识别为默认值0 ,不支持设置为0的参数报错|﻿  
|
|3|heap表，不同的数据量，自动采样率使用正确|heap表，导入数据blocks < 128K, 自动采样率收集统计信息,继续导入blocks > 128K，自动采样率收集统计信息|视图确认表的采样率,不同的采样率，NUM_ROWS等值有变化|
|4|lsc表，不同的数据量，自动采样率使用正确|lsc表，导入数据blocks < 128K, 自动采样率收集统计信息,继续导入blocks > 128K，自动采样率收集统计信息|视图确认表的采样率,不同的采样率，NUM_ROWS等值有变化|
|5|tac表，不同的数据量，自动采样率使用正确|tac表，导入数据blocks < 128K, 自动采样率收集统计信息,继续导入blocks > 128K，自动采样率收集统计信息|视图确认表的采样率,不同的采样率，NUM_ROWS等值有变化|
|6|分区表，不同的数据量，自动采样率使用正确|heap，不同分区采样，根据数据量不同，不同分区采样效果不同|﻿  
|
|7|SET_SCHEMA_PREFS设置后，测试效果|确认默认的采样率,设置后的SCHEMA中再建立其他的表，都使用设置的自动采样率|用例最终恢复默认的采样率|
|8|SET_DATABASE_PREFS设置后，测试效果|确认默认的采样率,设置后的DATABASE中再建立其他的用户和表，都使用设置的自动采样率|用例最终恢复默认的采样率|
|9|SET_GLOBAL_PREFS设置后测试效果|确认默认的采样率,设置后的所有的再建立其他的用户和表，都使用设置的自动采样率|用例最终恢复默认的采样率|
|11|资料测试|﻿  
|﻿  
|


# 5. 测试框架设计

# 6. 测试环境说明

|||
|---|---|
|服务器|﻿|
|操作系统|Linux|
|部署|单机、集群|


# 7. 工作量评估

工作量：XX人天

1. 特性熟悉+测试调研 – 0.5天
1. 研发串讲、测试设计+评审 – 1天 
1. 文本用例+自动化用例 -  2天 
1. 执行用例+测试 -  1.5天 
1. 上车分析 –  1天 


计划测试完成时间：2025/2/17