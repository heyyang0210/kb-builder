Created by 万谦, last modified on 七月 22, 2024

#   [存储支持对tmp目录使用限制](#存储支持对tmp目录使用限制)  

##   [1. Overview（概述）](#1-overview概述)  

tmp目录目前已有配置项限制其大小，计算部分已根据该大小进行限制。 存储也需要相应加以限制。

##   [2. Features（功能特性）](#2-features功能特性)  

存储在使用tmp目录写临时文件时 保证tmp目录下文件总大小不超过COLUMNAR_VM_SWAP_SIZE配置项限制。

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

**5.1计算限制tmp目录方式：**

ColumnarVmCtx上的columnarVmCtx维护全局使用的swap大小

```
pub struct ColumnarCtx {
    quota: Arc&lt;MaterialQuota&gt;,
    vm_swap_size: Arc&lt;AtomicU64&gt;,
    outline_lob_buf_id: AtomicUsize,
}

```

每次创建tempFile将其注入

```
pub struct TempFile {
    path: Box&lt;Path&gt;,
    file: File,
    ctx_op_swap_size: u64,
    ctx_used_swap_size: Arc&lt;AtomicU64&gt;,
    used_swap_size: u64,
}

```

写文件时检查是否超过大小

```
fn write(&amp;mut self, buf: &amp;[u8]) -&gt; Result&lt;usize&gt; {
        let res = self.as_file_mut().write(buf)?;
        let len = buf.len() as u64;
        self.used_swap_size += len;
        self.ctx_used_swap_size.fetch_add(len, Ordering::Relaxed);
        let ctx_used_swap_size = self.ctx_used_swap_size.load(Ordering::Acquire);
        if ctx_used_swap_size &gt; self.ctx_op_swap_size {
            return Err(std::io::Error::other(
                try_format!("can not allocate {} bytes from columnar vm swap", ctx_used_swap_size)
                    .map_err(std::io::Error::other)?,
            ));
        }
        Ok(res)
    }

```

tempFile释放时更新used size

```
impl Drop for TempFile {
    #[inline]
    fn drop(&amp;mut self) {
        let _ = fs::remove_file(&amp;self.path);
        self.ctx_used_swap_size
            .fetch_sub(self.used_swap_size, Ordering::Relaxed);
    }
}

```

**5.2存储使用tmp目录场景：**

1 dupRecvMeta

表空间迁移时目标端reclaim使用的sql临时文件 一般不会很大 MB级别

2 cvm source

内存不足时插入数据交换到临时文件

3 xfmr的sorter

排序内存不足时中间排序数据交换到临时文件

**5.3存储控制方案：**

存储层维护全局的tmp使用变量

rust调用c实现的allocVmSwapSize()和freeColVmSwapSize()函数实现控制

【1】dupRecvMeta由于文件较小可以忽略

【2】分别在sorter和cvmSource上绑定此回调完成写文件前申请 申请不到则报错

##   [6. 测试用例](#6-测试用例)  

##   [7. Document（资料）](#7-document资料)  

##   [8. Workload（工作量）](#8-workload工作量)  

一人周

##   [9. TODO（遗留问题）](#9-todo遗留问题)  