// Los correos del trámite de recuperar contraseña.
//
// A propósito NO llevan nada que haya escrito el usuario —ni su nombre—: así
// el HTML no necesita escapar nada y no hay forma de meter marcado en él a
// través de un dato del perfil. El código son solo dígitos generados acá.
import type { Correo } from '../mail/domain/mail-sender';

export function correoCodigo(
  para: string,
  codigo: string,
  minutos: number,
): Correo {
  return {
    para,
    // El código NO va en el asunto: el asunto sale en la notificación de la
    // pantalla bloqueada. Quien pida un restablecimiento para tu correo desde
    // su teléfono podría leerlo en tu móvil bloqueado sobre la mesa.
    asunto: 'Tu código para recuperar la contraseña de Ruédalo',
    texto: [
      `Tu código para recuperar la contraseña de Ruédalo es: ${codigo}`,
      '',
      `Vence en ${minutos} minutos y solo sirve una vez.`,
      '',
      'Si no pediste cambiar tu contraseña, ignora este correo: nadie puede',
      'cambiarla sin este código.',
    ].join('\n'),
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;color:#0A2540">
        <p>Tu código para recuperar la contraseña de <b>Ruédalo</b> es:</p>
        <p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:24px 0">${codigo}</p>
        <p>Vence en ${minutos} minutos y solo sirve una vez.</p>
        <p style="color:#64748B;font-size:13px">
          Si no pediste cambiar tu contraseña, ignora este correo: nadie puede
          cambiarla sin este código.
        </p>
      </div>`,
  };
}

export function correoContrasenaCambiada(para: string): Correo {
  return {
    para,
    asunto: 'Tu contraseña de Ruédalo cambió',
    texto: [
      'La contraseña de tu cuenta de Ruédalo se acaba de cambiar, y se',
      'cerró la sesión en todos tus dispositivos.',
      '',
      'Si fuiste tú, no tienes que hacer nada.',
      '',
      'Si NO fuiste tú, alguien tuvo acceso a este correo: cámbiale la',
      'contraseña al correo y luego recupera la de Ruédalo.',
    ].join('\n'),
  };
}
