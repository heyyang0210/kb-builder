Created by 孟麟 on 十月 31, 2023

# **1. 概述**

1.实现insert本地表select 远端表。

2.实现insert远端表select（本地表或者远端表的组合)。

# **2. 需求分析**

SR：    [YDBRD-13331](https://jira.yasdb.com/browse/YDBRD-13331?src=confmacro)    -  实现DBLINK INSERT INTO SELECT能力  完成

设计：    [YDBRD-13331%3A DBLINK INSERT INTO SELECT](/pages/createpage.action?spaceKey=YAS&title=YDBRD-13331%253A+DBLINK+INSERT+INTO+SELECT)  

单insert和select功能已经支持，实现insert into select功能主要的修改/适配点：

1、insert into tb1 select xx from tb2; 将用户输入的原始insert select语句改写成insert into tb1 values(:1, :2, :3); 语句，其中绑定参数的个数由insert 所跟的select 投影列列数决定。 

2、在当前已实现的blink select的基础上，本地数据库执行select， 将select的结果集作为上述改写后语句的绑定参数发送到远端数据库。

3、由于该实现将用户写的单条sql语句改写成上述形式，实际在远端执行了多次， 为保证一致性，如果发生错误，需要将远端数据库已经插入的数据进行回滚。本SR通过在向远端插入数据之前, 先向远端数据库发送save point xx, 

如果执行过程中发生错误，向远端数据库执行rollback to xx; 从而实现该语句的一致性。

# **3. 测试**  **设计方法**

1、通用的场景、组合等测试方法

2、已交付和覆盖了独立的insert和select功能，这里是insert与select结合，重点针对结合点进行测试设计并覆盖，主要包括：访问模式、数据类型、列的数量和约束；查询的语法、表的数量及类型等不做全面的覆盖。

# 4.   **详细测试设计**

# 5.   **测试用例**

  


# **6 测试框架设计**

## Attachments:

[实现DBLink_insert-into-select能力.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ZmNhMWFkOWEzMzExZGM3OWUxIiwicmVmX2lkIjoiNjczOTY5ZmM1OTNmOTljOWZmMjM1NGJlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjEwNjIxLCJleHAiOjE3ODIyOTcwMjF9.Ak1Azlar1hxJHmdeBDGciFtp2meV5sUhMdfqMXpscHU)

 (application/x-xmind)    
