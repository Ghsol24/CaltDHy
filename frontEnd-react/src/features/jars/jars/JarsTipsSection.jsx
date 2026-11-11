import React from 'react';
import { Icon } from '../../../components/ui/AppIcons';

export function JarsTipsSection({ handleOpenTips, isMobile, jarsSubTab }) {
  return ((!isMobile || jarsSubTab === 'goals') && (
  <section className="jars-financial-tips-grid">
    {/* Tip 1 */}
    <div className="jars-tip-card jars-tip-card--box" onClick={() => handleOpenTips('smart')}>
      <div className="jars-tip-icon-box">
        <Icon name="compass" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" />
      </div>
      <div className="jars-tip-body">
        <h3 className="jars-tip-title">Tại sao cần có mục tiêu?</h3>
        <p className="jars-tip-desc">
          Có mục tiêu rõ ràng giúp bạn có động lực tiết kiệm và đạt được những điều quan trọng trong cuộc sống.
        </p>
        <button type="button" className="jars-tip-link">
          <span>Tìm hiểu thêm</span>
          <span>→</span>
        </button>
      </div>
    </div>
  
    {/* Tip 2 */}
    <div className="jars-tip-card jars-tip-card--box" onClick={() => handleOpenTips('50-30-20')}>
      <div className="jars-tip-icon-box jars-tip-icon-box--success">
        <Icon name="barChart" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" />
      </div>
      <div className="jars-tip-body">
        <h3 className="jars-tip-title">Quy tắc 50/30/20</h3>
        <p className="jars-tip-desc">
          50% cho nhu cầu thiết yếu, 30% cho mong muốn cá nhân, 20% cho tiết kiệm và đầu tư.
        </p>
        <button type="button" className="jars-tip-link jars-tip-link--success">
          <span>Xem chi tiết & Tính toán</span>
          <span>→</span>
        </button>
      </div>
    </div>
  </section>
  )) || null;
}
