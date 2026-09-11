Created by 李世铭, last modified by  施新华 on 十一月 14, 2023

# 1.     **概述**

支持使用yasboot命令进行组内主备切换

# 2.     **需求分析**

  [YDBRD-13247](https://jira.yasdb.com/browse/YDBRD-13247?src=confmacro)    **-**  **【OM】支持分布式组内进行switchover和failover**  **完成**

### **2.1 功能分析**

支持主备切换命令：    
  1）yasboot node swithover

- 主备节点正常并且通信正常可执行。
- 单机主备部署，DN和MN组内多节点部署可执行。
- 只能备节点执行，主节点执行报错。


#### node switchover

本命令用于手动进行switchover主备切换。

|选项|含义|
|---|---|
|*-c, --cluster*|YashanDB的集群名（必传参数）|
|*-n, --node-id*|要升主的节点ID（例如1-1，可以通过cluster status命令查看，不需要冒号及后面的数字）（必传参数）|
|*-f, --force*|是否确认，默认不|
|*-w, --nowait*|运行后不等待执行命令结果|
|*-d, --child*|展示任务以及子任务信息|
|*--disable*|屏蔽运行的进度信息|


示例：

```
$ yasboot <span class="token function" style="color: rgb(240,141,73);">node</span> switchover <span class="token parameter variable" style="color: rgb(126,198,153);">-c</span> yashandb <span class="token parameter variable" style="color: rgb(126,198,153);">-n</span> <span class="token number" style="color: rgb(240,141,73);">4</span>-1
```

2）yasboot node failover

- 主节点不存在时，选取备节点执行；
- 打开自选，不能执行failover；
- 执行failover可能存在数据丢失。


#### node failover

本命令用于手动进行failover主备切换。

|选项|含义|
|---|---|
|*-c, --cluster*|YashanDB的集群名（必传参数）|
|*-n, --node-id*|要升主的节点ID（例如1-1，可以通过cluster status命令查看，不需要冒号及后面的数字）（必传参数）|
|*-w, --nowait*|运行后不等待执行命令结果|
|*-d, --child*|展示任务以及子任务信息|
|*--disable*|屏蔽运行的进度信息|


示例：

```
$ yasboot <span class="token function" style="color: rgb(240,141,73);">node</span> failover <span class="token parameter variable" style="color: rgb(126,198,153);">-c</span> yashandb <span class="token parameter variable" style="color: rgb(126,198,153);">-n</span> <span class="token number" style="color: rgb(240,141,73);">4</span>-1
```

# 3.   **测试设计方法**

主要采用场景法等进行测试设计

# 4.   **详细测试设计**

## Attachments:

[支持分布式组内进行switchover和failover.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5ODdhMWFkOWEzMzExZGM3NzYxIiwicmVmX2lkIjoiNjczOTY5ODY3MjgyMDZlZmI5MmVmM2ZlIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjA2OTExLCJleHAiOjE3ODIyOTMzMTF9.bCw7P6Fg4ksY7blehlcD1bYnXVvt81SZV7wPklS1MPc)

 (application/x-xmind)    
