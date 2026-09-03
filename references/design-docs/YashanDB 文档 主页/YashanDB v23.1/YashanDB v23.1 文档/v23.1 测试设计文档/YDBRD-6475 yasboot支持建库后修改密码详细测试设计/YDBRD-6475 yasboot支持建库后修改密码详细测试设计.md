Created by 施新华, last modified on 十一月 14, 2023

# 1.     **概述**

创建集群时，可以通过修改{cluster}.toml文件里的sys_password参数在建库时指定sys用户的密码，建库后可以使用yasboot cluster password set命令修改密码

# 2.     **需求分析**

SR：    [YDBRD-6475](https://jira.yasdb.com/browse/YDBRD-6475?src=confmacro)    -  yasboot支持建库后修改密码  完成

## cluster password set

本命令用于批量设置数据库集群中所有节点上实例的sys账号密码。

**如果使用密码工具yaspwd或使用ALTER USER修改sys密码，可能会导致yasboot连接不上节点，yasboot部分功能会受到影响。**

|选项|含义|
|---|---|
|*-c, --cluster*|YashanDB的集群名（必传参数）|
|*-o, --old-password*|旧sys密码，如果集群未在OM中管理，则需要旧密码（必传参数）|
|*-n, --new-password*|新的sys密码（必传参数）|
|*-w, --nowait*|运行后不等待执行命令结果|
|*-d, --child*|展示任务以及子任务信息|
|*--disable*|屏蔽任务进度条展示|


示例

```
$ yasboot cluster password <span class="token builtin class-name" style="color: rgb(204,153,205);">set</span> <span class="token parameter variable" style="color: rgb(126,198,153);">-n</span> newpasswd <span class="token parameter variable" style="color: rgb(126,198,153);">-c</span> yashandb
```

# 3.   **测试设计方法**

主要采用场景法，边界值法等进行测试设计   

# 4.   **详细测试设计**

# 5. 测试环境

覆盖单节点部署以及主备部署

## Attachments:

[yasboot支持修改密码.xmind](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NmM4OTcwYzJhZjRmNTFmODAzIiwicmVmX2lkIjoiNjczOTY5NmM3MjgyMDZlZmI5MmVmMzNhIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI3NDE3LCJleHAiOjE3ODIyMTM4MTd9.inbjdEu3hb3MBeIbuV6Ukz3kVDyjKSP6hvFVnow_oJQ)

 (application/x-xmind)    
