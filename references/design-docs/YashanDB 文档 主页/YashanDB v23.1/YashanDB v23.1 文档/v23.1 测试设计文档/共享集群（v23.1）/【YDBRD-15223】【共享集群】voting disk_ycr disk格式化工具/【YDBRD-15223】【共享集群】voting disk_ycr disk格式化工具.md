Created by 张彩虹, last modified on 十一月 13, 2023

**SR链接：**    [YDBRD-15223](https://jira.yasdb.com/browse/YDBRD-15223?src=confmacro)    **-**  **【共享集群】voting disk\ycr disk格式化工具**  **完成**

**开发设计文档：**    [【YCS】ycs初始化工具方案设计](122071139.html)  

# **1.概述**

本文描述  voting disk\ycr disk格式化工具  测试设计

# **2.需求分析**

YCS格式化工具，用于在集群重新部署时，YCS盘进行初始化的工具，防止旧的数据对新的集群产生干扰

# **3.规格**

1、部署形态：集群

2、集群节点数：三节点

3、集群部署模式：单主机磁阵+多主机磁阵

# **4.约束限制**

无

# **5.动态视图/配置参数**

无

**6.测试设计方法**

主要采用场景法、边界法、等价类划分法等进行设计。

1、命令测试

    1）有效命令

    ycsctl create cluster name -O

    ycsctl create cluster name -o

    ycsctl create cluster name -o --help

    ycsctl create cluster name -o -h

    2）无效命令

    不写-O参数

    -O后跟特殊字符（!!!、@@@、###、$$$等）

    -O之前跟特殊字符

    -O后跟数字

    3）多次执行格式化命令

    4）集群各个实例并发执行格式化命令

2、功能测试

    1）新装集群后校验age数值是否为0

    1）新装集群后进行topo变化后，观测age不为0后执行格式化命令，验证age值是否格式化为0

详细测试点参考"详细测试设计"

# **7.详细测试设计**

[voting disk&ycr disk格式化工具.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzdhMWFkOWEzMzExZGM3OGY1IiwicmVmX2lkIjoiNjczOTY5YzY3MjgyMDZlZmI5MmVmNzRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTYyLCJleHAiOjE3ODIyOTUzNjJ9.wrrMMkKfEO9x5d49iF_KX3UUb8w2RHtEG1-u1mqiiq8)

# **8.测试用例**

[【YDBRD-15223】【共享集群】voting diskycr disk格式化工具_文本测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzdhMWFkOWEzMzExZGM3OGY2IiwicmVmX2lkIjoiNjczOTY5YzY3MjgyMDZlZmI5MmVmNzRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTYyLCJleHAiOjE3ODIyOTUzNjJ9.mMZ_cA-rUKxEd8C9uDyWZMKpiAKvFLL1G0kMH7mE-CA)

[testcase.zip](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Yzc4OTcwYzJhZjRmNTFmYTgyIiwicmVmX2lkIjoiNjczOTY5YzY3MjgyMDZlZmI5MmVmNzRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTYyLCJleHAiOjE3ODIyOTUzNjJ9.rKIosQh38oEePlGrrryDNq2YIHaAMEQF2mxwVOtckOA)

# **9.测试框架/测试用例自动化**

anchor_regress

# **10.测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


# **11.测试版本**

## Attachments:

[voting disk&ycr disk格式化工具.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzdhMWFkOWEzMzExZGM3OGY1IiwicmVmX2lkIjoiNjczOTY5YzY3MjgyMDZlZmI5MmVmNzRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTYyLCJleHAiOjE3ODIyOTUzNjJ9.wrrMMkKfEO9x5d49iF_KX3UUb8w2RHtEG1-u1mqiiq8)

 (application/x-xmind)    


[【YDBRD-15223】【共享集群】voting diskycr disk格式化工具_文本测试用例_V1.0.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5YzdhMWFkOWEzMzExZGM3OGY2IiwicmVmX2lkIjoiNjczOTY5YzY3MjgyMDZlZmI5MmVmNzRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTYyLCJleHAiOjE3ODIyOTUzNjJ9.mMZ_cA-rUKxEd8C9uDyWZMKpiAKvFLL1G0kMH7mE-CA)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


[testcase.zip](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5Yzc4OTcwYzJhZjRmNTFmYTgyIiwicmVmX2lkIjoiNjczOTY5YzY3MjgyMDZlZmI5MmVmNzRlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA4OTYyLCJleHAiOjE3ODIyOTUzNjJ9.rKIosQh38oEePlGrrryDNq2YIHaAMEQF2mxwVOtckOA)

 (application/zip)    
